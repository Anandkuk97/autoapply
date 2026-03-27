import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Called after signup to ensure a users table row exists.
 * Uses admin client to bypass RLS.
 */
export async function POST(request: Request) {
  try {
    const { id, name, email } = await request.json();

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing id or email' }, { status: 400 });
    }

    console.log('[create-user] Creating user row:', { id, name, email });

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('users')
      .upsert({
        id,
        name: name || '',
        email
      }, { onConflict: 'id' })
      .select()
      .single();

    console.log('[create-user] Result:', { data, error });

    if (error) {
      console.error('[create-user] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[create-user] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
