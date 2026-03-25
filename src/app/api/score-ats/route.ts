import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    const { cv_text, jd_analysis } = await request.json();

    if (!cv_text || !jd_analysis) {
      return NextResponse.json({ error: 'Missing requirements (cv_text, jd_analysis)' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'You are an ATS scanner. Compare the CV text against the JD analysis constraints. Return ONLY valid raw JSON with no markdown block fences. Schema: { "score": number, "keywords_found": string[], "keywords_missing": string[] }. Score is 0-100.',
      messages: [
        { role: 'user', content: `JD Analysis Context: ${JSON.stringify(jd_analysis)}\n\nCandidate CV Text: ${cv_text}` }
      ],
    });

    const resultText = (response.content[0] as any).text.trim();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, ''));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('ATS Scorer Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate ATS compatibility via Claude API' }, 
      { status: 500 }
    );
  }
}
