import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  try {
    // Authenticate user via session cookies
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use admin client to bypass RLS for reads
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('name, email, cv_text, cv_parsed_json, target_roles, target_locations, salary_min, salary_max, work_type, excluded_companies')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log('[get-profile] Error:', profileError);
      // Row doesn't exist - return empty profile
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({ profile: null, userId: user.id });
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ profile, userId: user.id });
  } catch (error: any) {
    console.error('[get-profile] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
