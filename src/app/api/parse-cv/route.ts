import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

function extractJSON(text: string): Record<string, string> {
  try {
    return JSON.parse(text);
  } catch {}
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  throw new Error('Could not parse JSON from Claude response');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawText: string = body.text;

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'No CV text provided' }, { status: 400 });
    }

    // Use Claude to extract structured fields
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a CV/resume data extraction system. Extract structured information from the provided CV text.

Return ONLY a valid JSON object (no markdown, no explanation) with these fields:
- "fullName": the person's full name
- "email": email address
- "phone": phone number
- "location": city/country/address
- "education": full education history with degrees, institutions, and dates
- "workExperience": full work history with job titles, companies, dates, and descriptions
- "skills": all technical and soft skills listed
- "certifications": any certifications, licenses, or professional qualifications

For any field not found in the CV, use an empty string "". Extract as much detail as possible for workExperience and skills — include the full text of those sections.`,
      messages: [{ role: 'user', content: `Extract structured data from this CV:\n\n${rawText}` }]
    });

    const resultText = (response.content[0] as any).text.trim();
    const parsedData = extractJSON(resultText);

    return NextResponse.json({ text: rawText, parsedData });

  } catch (error: any) {
    console.error('Route error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
