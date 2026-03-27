import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { encrypt, decrypt } from '@/lib/encryption';

// Save LinkedIn credentials (encrypted)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Encrypt credentials
    const encryptedEmail = encrypt(email);
    const encryptedPassword = encrypt(password);

    // Upsert into user_settings
    const { error: upsertError } = await admin
      .from('user_settings')
      .upsert({
        user_id: user.id,
        linkedin_email_encrypted: encryptedEmail,
        linkedin_password_encrypted: encryptedPassword,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[linkedin-credentials] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'LinkedIn credentials saved securely' });
  } catch (err: any) {
    console.error('[linkedin-credentials] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Check if credentials exist (don't return the actual credentials)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('user_settings')
      .select('linkedin_email_encrypted, updated_at')
      .eq('user_id', user.id)
      .single();

    if (!settings?.linkedin_email_encrypted) {
      return NextResponse.json({ configured: false });
    }

    // Return masked email for display
    try {
      const email = decrypt(settings.linkedin_email_encrypted);
      const masked = email.replace(/(.{2}).*(@.*)/, '$1***$2');
      return NextResponse.json({
        configured: true,
        maskedEmail: masked,
        updatedAt: settings.updated_at
      });
    } catch {
      return NextResponse.json({ configured: false, error: 'Credentials corrupted' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete credentials
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    await admin
      .from('user_settings')
      .update({
        linkedin_email_encrypted: null,
        linkedin_password_encrypted: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message: 'LinkedIn credentials removed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
