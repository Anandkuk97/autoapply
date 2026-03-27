import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autoapply-five.vercel.app';

export async function POST(request: Request) {
  try {
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

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

    const { data: app } = await admin
      .from('applications')
      .select('role, company, match_score')
      .eq('id', application_id)
      .eq('user_id', user.id)
      .single();

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const { data: profile } = await admin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const toEmail = profile?.email || user.email;
    if (!toEmail) {
      return NextResponse.json({ error: 'No user email' }, { status: 400 });
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#f8f9fa;border-radius:12px;padding:30px;text-align:center;margin-bottom:24px;">
    <div style="font-size:48px;margin-bottom:12px;">&#9989;</div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#1a1a2e;">Application Submitted!</h1>
    <p style="margin:0;color:#666;font-size:14px;">You manually applied for this role.</p>
  </div>

  <div style="background:white;border:1px solid #e0e0e0;border-radius:12px;padding:24px;margin-bottom:24px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;width:120px;">Role</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;">${app.role}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;">Company</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;">${app.company}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888;font-size:13px;">Match Score</td>
        <td style="padding:8px 0;font-weight:600;font-size:14px;color:${(app.match_score || 0) >= 70 ? '#4CAF50' : '#FF9800'};">${app.match_score || 0}%</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;">
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#FFD700;color:#000;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;">
      Track Your Applications
    </a>
  </div>

  <p style="text-align:center;margin-top:24px;font-size:12px;color:#aaa;">
    Sent by AutoApply
  </p>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AutoApply <onboarding@resend.dev>',
        to: [toEmail],
        subject: `Application Submitted: ${app.role} at ${app.company}`,
        html,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[apply-email-confirm] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
