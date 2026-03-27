import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

function extractJSON(text: string): Record<string, any> {
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
      max_tokens: 8192,
      system: `You are a CV/resume data extraction system. Extract structured information from the provided CV text.

Return ONLY a valid JSON object (no markdown, no explanation) with these fields:

TOP-LEVEL STRING FIELDS (keep these as simple strings for backward compatibility):
- "fullName": the person's full name
- "email": email address
- "phone": phone number
- "location": city/country/address
- "education": full education history as a single string with degrees, institutions, and dates
- "workExperience": full work history as a single string with job titles, companies, dates, and descriptions
- "skills": all technical and soft skills as a single comma-separated string
- "certifications": any certifications, licenses, or professional qualifications as a single string

RICH STRUCTURED FIELDS (detailed breakdowns for better AI tailoring):
- "structured_experience": array of objects, each with:
  - "title": job title
  - "company": company name
  - "start_date": start date string (e.g. "Jan 2020")
  - "end_date": end date string or "Present"
  - "location": job location if mentioned
  - "bullets": array of achievement/responsibility strings
  - "technologies": array of specific tools/technologies mentioned in this role

- "structured_education": array of objects, each with:
  - "degree": degree name (e.g. "BSc Computer Science")
  - "institution": school/university name
  - "year": graduation year or date range
  - "grade": grade/GPA if mentioned

- "structured_skills": object with:
  - "technical": array of technical skill strings (programming languages, frameworks, tools)
  - "soft": array of soft skill strings (leadership, communication, etc.)
  - "languages": array of spoken languages with proficiency if mentioned
  - "tools": array of specific software/platforms (Jira, Figma, AWS, etc.)

- "structured_certifications": array of objects, each with:
  - "name": certification name
  - "issuer": issuing organization
  - "year": year obtained if mentioned

- "summary": the professional summary/objective if present in the CV, as a string
- "total_years_experience": estimated total years of professional experience as a number
- "seniority_level": one of "entry", "mid", "senior", "lead", "executive" based on experience
- "primary_domain": the candidate's primary professional domain (e.g. "Software Engineering", "Data Science", "Marketing")

For any field not found in the CV, use an empty string "", empty array [], or null as appropriate.`,
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
