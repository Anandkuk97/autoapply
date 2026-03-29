import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/utils/supabase/admin';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Allow CORS for the extension
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const { fields, user_id, job_description, mode, customPrompt } = await request.json();

    if (mode === 'assistant') {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        system: "You are an expert AI Job Application Assistant named AutoApply. Provide helpful, professional, and directly actionable advice to the user's queries based on the text they highlighted. Be concise. Do not wrap answers in JSON.",
        messages: [{ role: 'user', content: customPrompt }],
      });
      return NextResponse.json({ answer: (response.content[0] as any).text.trim() }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (!fields || !user_id || !job_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const admin = createAdminClient();
    const { data: userProfile } = await admin
      .from('users')
      .select('name, email, cv_text, cv_parsed_json')
      .eq('id', user_id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const systemPrompt = `You are an expert navigating a job application. Given the user's CV and the job description, answer the following form fields accurately without any fluff. 
Return ONLY a valid JSON object where keys are the field IDs and values are strings of your corresponding answers. Do not wrap in markdown block fences.`;

    const userMessage = `Job Description: \n${job_description}\n\nUser CV: \n${userProfile.cv_text}\n\nUser Details: ${JSON.stringify(userProfile.cv_parsed_json)}\n\nForm Fields to Answer: \n${JSON.stringify(fields)}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const answersText = (response.content[0] as any).text.trim();
    let answers = {};
    try {
      answers = JSON.parse(answersText);
    } catch {
      answers = JSON.parse(answersText.replace(/```json/g, '').replace(/```/g, ''));
    }

    return NextResponse.json(answers, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    console.error('Claude API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
