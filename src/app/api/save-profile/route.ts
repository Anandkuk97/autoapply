import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    // Authenticate user via session cookies
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[save-profile] Auth failed:', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, cv_text, cv_parsed_json } = body;

    console.log('[save-profile] User:', user.id, user.email);
    console.log('[save-profile] Saving name:', name, 'cv_text length:', cv_text?.length);

    // Use admin client to bypass RLS
    const admin = createAdminClient();

    const { data, error: upsertError } = await admin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name,
        cv_text,
        cv_parsed_json
      }, { onConflict: 'id' })
      .select()
      .single();

    console.log('[save-profile] Upsert result:', { error: upsertError, hasData: !!data });

    if (upsertError) {
      console.error('[save-profile] Upsert error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[save-profile] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
