import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    // Authenticate user via session cookies
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[save-preferences] Auth failed:', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      target_roles,
      target_locations,
      salary_min,
      salary_max,
      work_type,
      excluded_companies
    } = body;

    console.log('[save-preferences] User:', user.id, user.email);
    console.log('[save-preferences] Payload:', JSON.stringify(body, null, 2));

    // Use admin client to bypass RLS
    const admin = createAdminClient();

    // Upsert: create row if missing, update if exists
    const { data, error: upsertError } = await admin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        target_roles: target_roles || [],
        target_locations: target_locations || [],
        salary_min: salary_min || null,
        salary_max: salary_max || null,
        work_type: work_type || '',
        excluded_companies: excluded_companies || []
      }, { onConflict: 'id' })
      .select()
      .single();

    console.log('[save-preferences] Upsert result:', { data, error: upsertError });

    if (upsertError) {
      console.error('[save-preferences] Upsert error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Verify the write actually worked
    const { data: verify } = await admin
      .from('users')
      .select('id, target_roles, target_locations')
      .eq('id', user.id)
      .single();

    console.log('[save-preferences] Verification read:', verify);

    return NextResponse.json({
      success: true,
      data,
      verified: verify
    });
  } catch (error: any) {
    console.error('[save-preferences] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
