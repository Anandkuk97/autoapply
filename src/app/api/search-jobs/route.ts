import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  source: 'adzuna' | 'linkedin';
  source_url: string;
  posted_date: string;
}

// ── Adzuna API Search ──
async function searchAdzuna(
  role: string,
  location: string,
  salaryMin?: number,
  salaryMax?: number
): Promise<JobListing[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn('[search-jobs] Adzuna credentials not configured, skipping');
    return [];
  }

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '20',
      what: role,
      where: location,
      max_days_old: '20',
      sort_by: 'date',
    });
    if (salaryMin) params.set('salary_min', String(salaryMin));
    if (salaryMax) params.set('salary_max', String(salaryMax));

    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      console.error(`[search-jobs] Adzuna API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results: JobListing[] = (data.results || []).map((job: any) => ({
      id: `adzuna-${job.id}`,
      title: job.title || '',
      company: job.company?.display_name || 'Unknown Company',
      location: job.location?.display_name || location,
      salary: job.salary_is_predicted === '1'
        ? `~£${Math.round(job.salary_min || 0).toLocaleString()}-£${Math.round(job.salary_max || 0).toLocaleString()}`
        : job.salary_min
          ? `£${Math.round(job.salary_min).toLocaleString()}-£${Math.round(job.salary_max || job.salary_min).toLocaleString()}`
          : 'Not specified',
      description: job.description || '',
      source: 'adzuna' as const,
      source_url: job.redirect_url || '',
      posted_date: job.created || new Date().toISOString(),
    }));

    return results;
  } catch (err) {
    console.error('[search-jobs] Adzuna fetch error:', err);
    return [];
  }
}

// ── LinkedIn Guest API Search ──
async function searchLinkedIn(role: string, location: string): Promise<JobListing[]> {
  try {
    const params = new URLSearchParams({
      keywords: role,
      location: location,
      start: '0',
      f_TPR: 'r2592000', // Last 30 days
    });

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[search-jobs] LinkedIn API error: ${res.status}`);
      return [];
    }

    const html = await res.text();

    // Parse the HTML response - LinkedIn returns <li> cards
    const jobs: JobListing[] = [];
    const cardRegex = /<div class="base-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
    const titleRegex = /<span class="sr-only">([\s\S]*?)<\/span>/;
    const companyRegex = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/;
    const companyFallback = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/;
    const locationRegex = /<span class="job-search-card__location">([\s\S]*?)<\/span>/;
    const linkRegex = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*?)"/;
    const dateRegex = /<time[^>]*datetime="([^"]*?)"/;

    // Simpler approach: extract individual job listing blocks
    const listItems = html.split('<li>').slice(1);

    for (const item of listItems) {
      const titleMatch = item.match(titleRegex);
      const companyMatch = item.match(companyRegex) || item.match(companyFallback);
      const locationMatch = item.match(locationRegex);
      const linkMatch = item.match(linkRegex);
      const dateMatch = item.match(dateRegex);

      if (titleMatch) {
        const title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'");
        const company = companyMatch
          ? companyMatch[1].trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'")
          : 'Unknown Company';
        const jobLocation = locationMatch
          ? locationMatch[1].trim()
          : location;
        const jobUrl = linkMatch
          ? linkMatch[1].split('?')[0]
          : '';
        const postedDate = dateMatch
          ? dateMatch[1]
          : new Date().toISOString();

        jobs.push({
          id: `linkedin-${Buffer.from(title + company).toString('base64').slice(0, 20)}`,
          title,
          company,
          location: jobLocation,
          salary: 'Not specified',
          description: `${title} at ${company} - ${jobLocation}. Apply on LinkedIn for full details.`,
          source: 'linkedin',
          source_url: jobUrl,
          posted_date: postedDate,
        });
      }
    }

    // Filter out jobs older than 20 days
    const twentyDaysAgo = Date.now() - 20 * 24 * 60 * 60 * 1000;
    const filtered = jobs.filter(job => {
      const posted = new Date(job.posted_date).getTime();
      return !isNaN(posted) ? posted >= twentyDaysAgo : true; // Keep if date unparseable
    });

    return filtered.slice(0, 20); // Cap at 20
  } catch (err) {
    console.error('[search-jobs] LinkedIn fetch error:', err);
    return [];
  }
}

// ── Deduplication ──
function deduplicateJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Filter excluded companies ──
function filterExcluded(jobs: JobListing[], excluded: string[]): JobListing[] {
  if (!excluded || excluded.length === 0) return jobs;
  const excludedLower = excluded.map(c => c.toLowerCase().trim());
  return jobs.filter(job =>
    !excludedLower.some(exc => job.company.toLowerCase().includes(exc))
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user preferences using admin client to bypass RLS
    console.log('[search-jobs] Looking up preferences for user:', user.id, user.email);

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('target_roles, target_locations, salary_min, salary_max, excluded_companies')
      .eq('id', user.id)
      .single();

    console.log('[search-jobs] Profile query result:', JSON.stringify({ profile, error: profileError }));

    if (profileError || !profile) {
      // If row doesn't exist, try creating it
      if (profileError?.code === 'PGRST116') {
        console.log('[search-jobs] User row not found, creating it...');
        await admin.from('users').upsert({
          id: user.id,
          email: user.email,
        }, { onConflict: 'id' });
      }
      return NextResponse.json(
        { error: 'Profile not found. Please set your job preferences in the Preferences page first.' },
        { status: 404 }
      );
    }

    const { target_roles, target_locations, salary_min, salary_max, excluded_companies } = profile;

    console.log('[search-jobs] User preferences:', {
      target_roles,
      target_locations,
      salary_min,
      salary_max,
      excluded_companies
    });

    if (!target_roles?.length || !target_locations?.length) {
      return NextResponse.json(
        { error: `Please set target roles and locations in Preferences before searching. Current: roles=${JSON.stringify(target_roles)}, locations=${JSON.stringify(target_locations)}` },
        { status: 400 }
      );
    }

    // Search for each combination of role + location
    const allJobs: JobListing[] = [];
    const searchPromises: Promise<JobListing[]>[] = [];

    for (const role of target_roles) {
      for (const location of target_locations) {
        searchPromises.push(searchAdzuna(role, location, salary_min, salary_max));
        searchPromises.push(searchLinkedIn(role, location));
      }
    }

    const results = await Promise.all(searchPromises);
    for (const batch of results) {
      allJobs.push(...batch);
    }

    // Filter, deduplicate, sort newest first
    let jobs = deduplicateJobs(allJobs);
    jobs = filterExcluded(jobs, excluded_companies || []);
    jobs.sort((a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime());

    // Save to job_listings table
    if (jobs.length > 0) {
      const rows = jobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        description: job.description.slice(0, 5000), // Truncate long descriptions
        source_url: job.source_url,
        source: job.source,
        posted_date: job.posted_date,
      }));

      const { error: insertError } = await admin
        .from('job_listings')
        .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true });

      if (insertError) {
        console.error('[search-jobs] DB insert error:', insertError);
        // Non-fatal — still return the jobs
      }
    }

    return NextResponse.json({
      total_found: jobs.length,
      search_criteria: {
        roles: target_roles,
        locations: target_locations,
        salary_range: salary_min || salary_max
          ? `£${(salary_min || 0).toLocaleString()} - £${(salary_max || 0).toLocaleString()}`
          : 'Any',
      },
      jobs,
    });
  } catch (error: any) {
    console.error('[search-jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Job search failed' },
      { status: 500 }
    );
  }
}
