import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { application_id } = await request.json();
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

    // Fetch user profile for contact details and common answers
    const { data: profile } = await admin
      .from('users')
      .select('name, email, cv_text, cv_parsed_json, target_roles, target_locations')
      .eq('id', user.id)
      .single();

    const parsed = profile?.cv_parsed_json || {};

    // Build common answers from parsed CV data
    const totalYears = parsed.total_years_experience || '';
    const education = parsed.structured_education?.[0]?.degree || parsed.education || '';

    const applicationPackage = {
      application_id: app.id,
      job_url: app.source_url || '',
      company_name: app.company || '',
      role_title: app.role || '',
      location: app.location || '',
      salary: app.salary || 'Not specified',
      applicant: {
        name: parsed.fullName || profile?.name || '',
        email: parsed.email || profile?.email || user.email || '',
        phone: parsed.phone || '',
        location: parsed.location || '',
        linkedin: '',
        portfolio: '',
      },
      tailored_cv_text: app.tailored_cv || '',
      cover_letter_text: app.cover_letter || '',
      match_score: app.match_score || 0,
      status: app.status,
      applied_date: app.applied_date,
      common_answers: {
        years_experience: totalYears ? String(totalYears) : '',
        highest_education: education,
        work_authorization: '',
        notice_period: '',
        salary_expectation: app.salary && app.salary !== 'Not specified' ? app.salary : 'Negotiable',
        willing_to_relocate: '',
        require_sponsorship: '',
      },
    };

    return NextResponse.json(applicationPackage);

  } catch (error: any) {
    console.error('[prepare-application] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to prepare application' }, { status: 500 });
  }
}
