import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { decrypt } from '@/lib/encryption';

// Dynamic import to avoid build-time issues with puppeteer
async function getAutomator() {
  const mod = await import('@/lib/linkedin-automator');
  return mod;
}

export const maxDuration = 300; // 5 min max for Vercel

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  // SSE stream for real-time progress
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Auth check
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          sendEvent({ error: 'Unauthorized', done: true });
          controller.close();
          return;
        }

        const body = await request.json();
        const { application_ids } = body;

        if (!application_ids || !Array.isArray(application_ids) || application_ids.length === 0) {
          sendEvent({ error: 'No application IDs provided', done: true });
          controller.close();
          return;
        }

        // Dynamic import
        const { launchBrowser, loginToLinkedIn, applyToJob, MAX_APPS_PER_SESSION } = await getAutomator();

        // Enforce limit
        const limitedIds = application_ids.slice(0, MAX_APPS_PER_SESSION);
        if (application_ids.length > MAX_APPS_PER_SESSION) {
          sendEvent({
            warning: `Limited to ${MAX_APPS_PER_SESSION} applications per session. ${application_ids.length - MAX_APPS_PER_SESSION} skipped.`
          });
        }

        const admin = createAdminClient();

        // Get user's LinkedIn credentials
        const { data: settings } = await admin
          .from('user_settings')
          .select('linkedin_email_encrypted, linkedin_password_encrypted')
          .eq('user_id', user.id)
          .single();

        if (!settings?.linkedin_email_encrypted || !settings?.linkedin_password_encrypted) {
          sendEvent({
            error: 'LinkedIn credentials not configured. Go to Settings to add your LinkedIn login.',
            done: true
          });
          controller.close();
          return;
        }

        let linkedinEmail: string;
        let linkedinPassword: string;
        try {
          linkedinEmail = decrypt(settings.linkedin_email_encrypted);
          linkedinPassword = decrypt(settings.linkedin_password_encrypted);
        } catch {
          sendEvent({ error: 'Failed to decrypt LinkedIn credentials. Please re-enter them in Settings.', done: true });
          controller.close();
          return;
        }

        // Get user profile data
        const { data: profile } = await admin
          .from('users')
          .select('name, email, cv_parsed_json')
          .eq('id', user.id)
          .single();

        const parsed = profile?.cv_parsed_json || {};
        const applicantData = {
          name: parsed.fullName || profile?.name || '',
          email: parsed.email || profile?.email || user.email || '',
          phone: parsed.phone || '',
          headline: parsed.headline || parsed.title || '',
        };

        // Fetch applications
        const { data: applications } = await admin
          .from('applications')
          .select('*')
          .in('id', limitedIds)
          .eq('user_id', user.id);

        if (!applications || applications.length === 0) {
          sendEvent({ error: 'No valid applications found', done: true });
          controller.close();
          return;
        }

        // Filter to only LinkedIn jobs with source URLs
        const linkedInApps = applications.filter(app =>
          app.source_url && (
            app.source_url.includes('linkedin.com') ||
            app.source === 'LinkedIn'
          )
        );

        if (linkedInApps.length === 0) {
          sendEvent({
            error: 'No LinkedIn jobs found in selection. Auto-submit currently only works with LinkedIn Easy Apply.',
            done: true
          });
          controller.close();
          return;
        }

        sendEvent({
          message: `Starting auto-submit for ${linkedInApps.length} LinkedIn job(s)...`,
          total: linkedInApps.length
        });

        // Launch browser
        let browser;
        try {
          browser = await launchBrowser();
          sendEvent({ message: 'Browser launched' });
        } catch (err: any) {
          sendEvent({ error: `Failed to launch browser: ${err.message}`, done: true });
          controller.close();
          return;
        }

        try {
          const page = await browser.newPage();

          // Set user agent
          await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          // Login
          const loggedIn = await loginToLinkedIn(
            page,
            { email: linkedinEmail, password: linkedinPassword },
            (progress) => sendEvent({ progress, phase: 'login' })
          );

          if (!loggedIn) {
            sendEvent({ error: 'LinkedIn login failed. Check your credentials in Settings.', done: true });
            await browser.close();
            controller.close();
            return;
          }

          // Process each application
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < linkedInApps.length; i++) {
            const app = linkedInApps[i];

            sendEvent({
              message: `Processing ${i + 1}/${linkedInApps.length}: ${app.role} at ${app.company}`,
              current: i + 1,
              total: linkedInApps.length
            });

            const result = await applyToJob(
              page,
              app.source_url,
              {
                ...applicantData,
                coverLetter: app.cover_letter || '',
              },
              (progress) => sendEvent({
                progress,
                phase: 'apply',
                applicationId: app.id,
                jobTitle: `${app.role} at ${app.company}`,
                current: i + 1,
                total: linkedInApps.length
              })
            );

            if (result.captchaDetected) {
              sendEvent({
                error: 'CAPTCHA detected — stopping to protect your account. Try again later.',
                captcha: true,
                done: true
              });
              break;
            }

            if (result.success) {
              successCount++;
              // Update application status
              await admin
                .from('applications')
                .update({
                  status: 'Applied',
                  applied_date: new Date().toISOString(),
                  apply_method: 'auto-linkedin',
                })
                .eq('id', app.id);

              sendEvent({
                applied: { id: app.id, role: app.role, company: app.company },
                successCount,
                failCount
              });
            } else {
              failCount++;
              sendEvent({
                failed: { id: app.id, role: app.role, company: app.company, error: result.error },
                successCount,
                failCount
              });
            }

            // Random delay between applications
            if (i < linkedInApps.length - 1) {
              const waitMs = 5000 + Math.random() * 10000;
              sendEvent({ message: `Waiting ${Math.round(waitMs / 1000)}s before next application...` });
              await new Promise(r => setTimeout(r, waitMs));
            }
          }

          sendEvent({
            message: `Auto-submit complete: ${successCount} submitted, ${failCount} failed`,
            successCount,
            failCount,
            done: true
          });

          await browser.close();
        } catch (err: any) {
          sendEvent({ error: `Browser error: ${err.message}`, done: true });
          await browser?.close();
        }
      } catch (err: any) {
        sendEvent({ error: err.message || 'Auto-submit failed', done: true });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
