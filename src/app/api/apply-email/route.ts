import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autoapply-five.vercel.app';

interface EmailPayload {
  application_id: string;
  recipient_email?: string; // Optional override; otherwise use HR email from job or fallback
}

async function sendViaResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.reply_to,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errBody}`);
  }

  return res.json();
}

function buildApplicationEmail(pkg: {
  applicant_name: string;
  role_title: string;
  company_name: string;
  cover_letter: string;
  match_score: number;
}): string {
  // Convert cover letter to HTML paragraphs
  const coverLetterHtml = pkg.cover_letter
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p style="margin:0 0 12px 0;line-height:1.6;color:#333;">${line}</p>`)
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,'Times New Roman',serif;max-width:650px;margin:0 auto;padding:20px;color:#333;">
  <div style="margin-bottom:30px;">
    ${coverLetterHtml}
  </div>
  <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
  <p style="font-size:12px;color:#888;">
    This application was prepared using AutoApply. The attached CV has been tailored for this role.
  </p>
</body>
</html>`;
}

function buildConfirmationEmail(pkg: {
  applicant_name: string;
  role_title: string;
  company_name: string;
  match_score: number;
  recipient_email: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#f8f9fa;border-radius:12px;padding:30px;text-align:center;margin-bottom:24px;">
    <div style="font-size:48px;margin-bottom:12px;">✅</div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#1a1a2e;">Application Submitted!</h1>
    <p style="margin:0;color:#666;font-size:14px;">Your application has been sent successfully.</p>
  </div>

  <div style="background:white;border:1px solid #e0e0e0;border-radius:12px;padding:24px;margin-bottom:24px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;width:120px;">Role</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;">${pkg.role_title}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;">Company</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;">${pkg.company_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;">Match Score</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;color:${pkg.match_score >= 70 ? '#4CAF50' : pkg.match_score >= 50 ? '#FF9800' : '#f44336'};">${pkg.match_score}%</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;">Sent to</td>
        <td style="padding:8px 0;font-size:14px;">${pkg.recipient_email}</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;">
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#FFD700;color:#000;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;">
      Track Your Applications →
    </a>
  </div>

  <p style="text-align:center;margin-top:24px;font-size:12px;color:#aaa;">
    Sent by AutoApply • <a href="${APP_URL}" style="color:#aaa;">autoapply-five.vercel.app</a>
  </p>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured. Add RESEND_API_KEY to environment variables.' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: EmailPayload = await request.json();
    const { application_id, recipient_email } = body;

    if (!application_id) {
      return NextResponse.json({ error: 'Missing application_id' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch application
    const { data: app, error: appError } = await admin
      .from('applications')
      .select('*')
      .eq('id', application_id)
      .eq('user_id', user.id)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Fetch user profile
    const { data: profile } = await admin
      .from('users')
      .select('name, email, cv_parsed_json')
      .eq('id', user.id)
      .single();

    const parsed = profile?.cv_parsed_json || {};
    const applicantName = parsed.fullName || profile?.name || 'Applicant';
    const applicantEmail = parsed.email || profile?.email || user.email || '';

    // Determine recipient
    const toEmail = recipient_email || '';
    if (!toEmail) {
      return NextResponse.json(
        { error: 'No recipient email provided. Enter the hiring manager or HR email address.' },
        { status: 400 }
      );
    }

    // Build and send application email
    const subject = `Application: ${app.role} - ${applicantName}`;
    const htmlBody = buildApplicationEmail({
      applicant_name: applicantName,
      role_title: app.role,
      company_name: app.company,
      cover_letter: app.cover_letter || '',
      match_score: app.match_score || 0,
    });

    // Send application email
    // Note: Using onboarding@resend.dev as from address (Resend free tier requires verified domain)
    // In production, use your own verified domain
    const emailResult = await sendViaResend({
      from: `${applicantName} via AutoApply <onboarding@resend.dev>`,
      to: toEmail,
      subject,
      html: htmlBody,
      reply_to: applicantEmail,
    });

    console.log('[apply-email] Application email sent:', emailResult);

    // Update application status
    await admin
      .from('applications')
      .update({
        status: 'Applied',
        applied_date: new Date().toISOString(),
      })
      .eq('id', application_id);

    // Send confirmation email to applicant
    if (applicantEmail) {
      try {
        const confirmHtml = buildConfirmationEmail({
          applicant_name: applicantName,
          role_title: app.role,
          company_name: app.company,
          match_score: app.match_score || 0,
          recipient_email: toEmail,
        });

        await sendViaResend({
          from: 'AutoApply <onboarding@resend.dev>',
          to: applicantEmail,
          subject: `Application Sent: ${app.role} at ${app.company}`,
          html: confirmHtml,
          reply_to: 'noreply@autoapply.app',
        });

        console.log('[apply-email] Confirmation email sent to:', applicantEmail);
      } catch (confirmErr) {
        console.warn('[apply-email] Confirmation email failed (non-fatal):', confirmErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Application email sent to ${toEmail}`,
      email_id: emailResult?.id,
      recipient: toEmail,
    });

  } catch (error: any) {
    console.error('[apply-email] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send application email' },
      { status: 500 }
    );
  }
}
