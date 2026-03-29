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
    const body = await request.json();
    const rawText: string = body.text;
    const fileData: string = body.fileData; // base64 pdf string
    const userId: string = body.userId;

    if ((!rawText || rawText.trim().length === 0) && !fileData) {
      return NextResponse.json({ error: 'No CV text or file provided' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let messageContent: any[] = [];
    if (fileData) {
      messageContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileData }
      });
      messageContent.push({ type: 'text', text: 'Extract structured data from this PDF CV.' });
    } else {
      messageContent.push({ type: 'text', text: `Extract structured data from this CV:\n\n${rawText}` });
    }

    // Use Claude to extract structured fields
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
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
      messages: [{ role: 'user', content: messageContent }]
    });

    const resultText = (response.content[0] as any).text.trim();
    const parsedData = extractJSON(resultText);

    if (userId) {
      // Background save of profile updates when uploaded from Extension Side Panel
      try {
        const { createAdminClient } = await import('@/utils/supabase/admin');
        const admin = createAdminClient();
        
        await admin.from('users').update({
          name: parsedData.fullName || null,
          cv_text: rawText || 'Extracted via Base64 Extension Upload',
          cv_parsed_json: parsedData
        }).eq('id', userId);
        
        // Ensure profile exists or is mapped properly. 
      } catch (e) {
        console.error("Failed silently to link DB user profile", e);
      }
    }

    return NextResponse.json(
      { text: rawText || 'Extracted via Base64 Extension Upload', parsedData },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error: any) {
    console.error('Route error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
