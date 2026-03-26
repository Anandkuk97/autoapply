import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const MAX_JOBS = 50;
const MIN_MATCH_SCORE = 65;
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const maxDuration = 300; // Allow up to 5 minutes for this route

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has a CV
    const { data: profile } = await supabase
      .from('users')
      .select('cv_text')
      .eq('id', user.id)
      .single();

    if (!profile?.cv_text) {
      return NextResponse.json(
        { error: 'Please upload your CV before running auto-apply.' },
        { status: 400 }
      );
    }

    // Step 1: Search for jobs
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
      return NextResponse.json(
        { error: `Job search failed: ${err.error}` },
        { status: 500 }
      );
    }

    const searchData = await searchRes.json();
    const jobs = (searchData.jobs || []).slice(0, MAX_JOBS);

    if (jobs.length === 0) {
      return NextResponse.json({
        total_found: 0,
        total_qualified: 0,
        total_generated: 0,
        applications: [],
        message: 'No matching jobs found. Try adjusting your preferences.',
      });
    }

    // Step 2: Process each job — generate application
    const applications: any[] = [];
    let totalQualified = 0;
    let totalGenerated = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      // Build a synthetic JD from the job listing
      const syntheticJD = [
        `Job Title: ${job.title}`,
        `Company: ${job.company}`,
        `Location: ${job.location}`,
        job.salary !== 'Not specified' ? `Salary: ${job.salary}` : '',
        '',
        'Job Description:',
        job.description,
      ].filter(Boolean).join('\n');

      try {
        // Call generate-application
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

        if (!genRes.ok) {
          console.error(`[auto-apply] Generation failed for job ${i + 1}/${jobs.length}: ${job.title} at ${job.company}`);
          continue;
        }

        const genData = await genRes.json();
        const matchScore = genData.match_assessment?.score || 0;

        // Step 3: Only proceed with jobs scoring >= 65%
        if (matchScore < MIN_MATCH_SCORE) {
          console.log(`[auto-apply] Skipping ${job.title} at ${job.company}: score ${matchScore}% < ${MIN_MATCH_SCORE}%`);
          continue;
        }

        totalQualified++;

        // Step 4: Save to applications table with status "ready"
        const { data: inserted, error: dbError } = await supabase
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
          applications.push({
            id: inserted.id,
            company: inserted.company,
            role: inserted.role,
            location: inserted.location,
            match_score: inserted.match_score,
            status: inserted.status,
            source: job.source,
            source_url: job.source_url,
          });
        }
      } catch (err) {
        console.error(`[auto-apply] Error processing job ${i + 1}:`, err);
      }

      // Rate limit: 2-second delay between API calls
      if (i < jobs.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // Step 5: Return summary
    return NextResponse.json({
      total_found: jobs.length,
      total_qualified: totalQualified,
      total_generated: totalGenerated,
      applications,
    });
  } catch (error: any) {
    console.error('[auto-apply] Pipeline error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-apply pipeline failed' },
      { status: 500 }
    );
  }
}
