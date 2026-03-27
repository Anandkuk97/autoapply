import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const MAX_JOBS = 50;
const MIN_MATCH_SCORE = 65;
const DELAY_MS = 3000;
const RATE_LIMIT_RETRY_MS = 10000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const maxDuration = 300; // 5 minutes max

export async function POST(request: Request) {
  // Authenticate first
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify CV exists
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('cv_text')
    .eq('id', user.id)
    .single();

  if (!profile?.cv_text) {
    return new Response(JSON.stringify({ error: 'Please upload your CV before running auto-apply.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      try {
        // Step 1: Search for jobs
        send('progress', { phase: 'searching', message: 'Searching for matching jobs...' });

        const baseUrl = request.url.replace(/\/api\/auto-apply.*$/, '');
        const searchRes = await fetch(`${baseUrl}/api/search-jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
        });

        if (!searchRes.ok) {
          const err = await searchRes.json();
          send('error', { message: `Job search failed: ${err.error}` });
          controller.close();
          return;
        }

        const searchData = await searchRes.json();
        const allJobs = searchData.jobs || [];

        // Cap at MAX_JOBS, sorted by those with salary info first (rough relevance)
        const jobs = allJobs
          .sort((a: any, b: any) => {
            const aHasSalary = a.salary !== 'Not specified' ? 1 : 0;
            const bHasSalary = b.salary !== 'Not specified' ? 1 : 0;
            return bHasSalary - aHasSalary;
          })
          .slice(0, MAX_JOBS);

        if (jobs.length === 0) {
          send('complete', {
            total_found: 0,
            total_processed: 0,
            total_qualified: 0,
            total_generated: 0,
            total_skipped: 0,
            total_errors: 0,
            estimated_cost: '$0.00',
            message: 'No matching jobs found. Try adjusting your preferences.',
          });
          controller.close();
          return;
        }

        send('progress', {
          phase: 'generating',
          message: `Found ${allJobs.length} jobs, processing top ${jobs.length}...`,
          total: jobs.length,
        });

        // Step 2: Process each job
        let totalProcessed = 0;
        let totalQualified = 0;
        let totalGenerated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for (let i = 0; i < jobs.length; i++) {
          if (cancelled) {
            send('cancelled', {
              message: 'Pipeline cancelled by user.',
              total_processed: totalProcessed,
              total_generated: totalGenerated,
            });
            break;
          }

          const job = jobs[i];
          totalProcessed++;

          send('job_start', {
            current: i + 1,
            total: jobs.length,
            status: 'generating',
            job_title: job.title,
            company: job.company,
          });

          // Build synthetic JD
          const syntheticJD = [
            `Job Title: ${job.title}`,
            `Company: ${job.company}`,
            `Location: ${job.location}`,
            job.salary !== 'Not specified' ? `Salary: ${job.salary}` : '',
            '',
            'Job Description:',
            job.description,
          ].filter(Boolean).join('\n');

          let genData: any = null;
          let retried = false;

          // Try generating, with one retry on rate limit
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const genRes = await fetch(`${baseUrl}/api/generate-application`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  cookie: request.headers.get('cookie') || '',
                },
                body: JSON.stringify({
                  job_description: syntheticJD,
                  user_id: user.id,
                }),
              });

              if (genRes.status === 429) {
                if (attempt === 0) {
                  console.log(`[auto-apply] Rate limited on job ${i + 1}, retrying in 10s...`);
                  send('job_retry', {
                    current: i + 1,
                    total: jobs.length,
                    job_title: job.title,
                    company: job.company,
                    message: 'Rate limited, retrying in 10s...',
                  });
                  retried = true;
                  await sleep(RATE_LIMIT_RETRY_MS);
                  continue;
                } else {
                  throw new Error('Rate limited after retry');
                }
              }

              if (!genRes.ok) {
                const errBody = await genRes.text();
                throw new Error(`API error ${genRes.status}: ${errBody.slice(0, 200)}`);
              }

              genData = await genRes.json();
              break; // Success, exit retry loop
            } catch (err: any) {
              if (attempt === 1 || !err.message?.includes('Rate limited')) {
                console.error(`[auto-apply] Job ${i + 1}/${jobs.length} failed:`, err.message);
                send('job_error', {
                  current: i + 1,
                  total: jobs.length,
                  job_title: job.title,
                  company: job.company,
                  error: err.message,
                });
                totalErrors++;
                genData = null;
                break;
              }
            }
          }

          if (!genData) {
            // Failed after retries, continue to next job
            if (i < jobs.length - 1) await sleep(DELAY_MS);
            continue;
          }

          const matchScore = genData.match_assessment?.score || 0;

          // Estimate token usage (rough: ~2000 input + ~3000 output per call, 4 calls per job)
          totalInputTokens += 8000;
          totalOutputTokens += 8000;

          // Check match score
          if (matchScore < MIN_MATCH_SCORE) {
            totalSkipped++;
            send('job_skipped', {
              current: i + 1,
              total: jobs.length,
              job_title: job.title,
              company: job.company,
              match_score: matchScore,
              reason: `Below ${MIN_MATCH_SCORE}% threshold`,
            });
            if (i < jobs.length - 1) await sleep(DELAY_MS);
            continue;
          }

          totalQualified++;

          // Save to DB
          const { data: inserted, error: dbError } = await admin
            .from('applications')
            .insert({
              user_id: user.id,
              company: genData.jd_analysis?.company || job.company,
              role: genData.jd_analysis?.title || job.title,
              location: genData.jd_analysis?.location || job.location,
              salary: job.salary,
              match_score: matchScore,
              status: 'ready',
              tailored_cv: genData.tailored_cv,
              cover_letter: genData.cover_letter,
              jd_text: syntheticJD,
              source_url: job.source_url,
            })
            .select()
            .single();

          if (!dbError && inserted) {
            totalGenerated++;
            send('job_complete', {
              current: i + 1,
              total: jobs.length,
              job_title: inserted.role,
              company: inserted.company,
              location: inserted.location,
              match_score: matchScore,
              application_id: inserted.id,
              application: inserted,
            });
          } else {
            totalErrors++;
            console.error(`[auto-apply] DB save failed for job ${i + 1}:`, dbError);
          }

          // Rate limit delay
          if (i < jobs.length - 1) {
            await sleep(DELAY_MS);
          }
        }

        // Estimate cost: Sonnet ~$3/M input, ~$15/M output tokens
        const inputCost = (totalInputTokens / 1_000_000) * 3;
        const outputCost = (totalOutputTokens / 1_000_000) * 15;
        const estimatedCost = (inputCost + outputCost).toFixed(2);

        // Send final summary
        send('complete', {
          total_found: allJobs.length,
          total_processed: totalProcessed,
          total_qualified: totalQualified,
          total_generated: totalGenerated,
          total_skipped: totalSkipped,
          total_errors: totalErrors,
          estimated_cost: `$${estimatedCost}`,
        });
      } catch (err: any) {
        console.error('[auto-apply] Pipeline error:', err);
        send('error', { message: err.message || 'Pipeline failed' });
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() {
      cancelled = true;
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
