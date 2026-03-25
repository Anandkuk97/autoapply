import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    const { job_description, user_id } = await request.json();

    if (!job_description || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userProfile, error: dbError } = await supabase
      .from('users')
      .select('name, email, cv_text, cv_parsed_json')
      .eq('id', user_id)
      .single();

    if (dbError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Step 1: JD Analyzer
    const step1Response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'You are an expert HR recruiter. Analyze the job description and extract key points. Return ONLY valid raw JSON with no markdown block fences. Schema: { "company": string, "title": string, "location": string, "hard_requirements": string[], "soft_requirements": string[], "ats_keywords": string[], "action_verbs": string[], "culture_signals": string[], "pain_points": string[], "seniority": string }. ats_keywords must be an array of top 15.',
      messages: [{ role: 'user', content: job_description }],
    });
    
    const jdAnalysisText = (step1Response.content[0] as any).text.trim();
    let jdAnalysis;
    try {
      jdAnalysis = JSON.parse(jdAnalysisText);
    } catch {
      // Best-effort cleanup if Claude wraps in markdown despite instructions
      jdAnalysis = JSON.parse(jdAnalysisText.replace(/```json/g, '').replace(/```/g, ''));
    }

    // Step 2: Match Scorer
    const step2Response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'You are a strict technical recruiter. Score the user profile against the JD Analysis. Return ONLY valid raw JSON with no markdown block fences. Be completely honest and do not inflate scores. Schema: { "score": number, "verdict": "APPLY"|"REVIEW"|"SKIP", "strong_matches": string[], "gaps": string[], "reframe_opportunities": string[], "narrative_angle": string }',
      messages: [
        { role: 'user', content: `JD Analysis: ${JSON.stringify(jdAnalysis)}\n\nUser Profile CV Text: ${userProfile.cv_text}\n\nUser Parsed Data: ${JSON.stringify(userProfile.cv_parsed_json)}` }
      ],
    });
    
    const matchAssessmentText = (step2Response.content[0] as any).text.trim();
    let matchAssessment;
    try {
       matchAssessment = JSON.parse(matchAssessmentText);
    } catch {
       matchAssessment = JSON.parse(matchAssessmentText.replace(/```json/g, '').replace(/```/g, ''));
    }

    // Prepare Step 3 and 4 Systems
    const parsedData = userProfile.cv_parsed_json || {};
    const phone = parsedData.phone || 'Phone';
    const email = userProfile.email || parsedData.email || 'Email';
    const cityCountry = parsedData.location || 'City, Country';

    const step3SystemPrompt = `You are a professional resume writer. Generate a tailored CV based on the user's base CV, adapting it for the provided Job Analysis and Match Scorer context.
EXACT FORMAT RULES:
- Full name in CAPS at the top (Use user profile name)
- Subtitle line: Role Title | Specialty
- Contact line: ${cityCountry} | ${phone} | ${email} (Use ONLY these real details)
- PROFESSIONAL SUMMARY: 2-3 sentence paragraph, no bullets
- CORE COMPETENCIES: bullet points using the character •, arranged as a list
- PROFESSIONAL EXPERIENCE: each role has title, company, location, dates. Bullets use • character ONLY, never dashes. Dates right-aligned format "Mon YYYY - Mon YYYY"
- KEY ACHIEVEMENTS: separate section with 3-4 quantified results using • bullets
- SELECTED PROJECT: one relevant project with • bullets
- EDUCATION: exactly 2 most recent qualifications
- CERTIFICATIONS & TECHNICAL SKILLS: Certifications, Tools, and Methods listed
- NEVER use em dashes (—). Always use hyphens (-).
- NEVER fabricate experience. Only reframe existing experience securely linked to their capabilities.
Output only the plain text CV with no introduction or markdown wrappers.`;

    const step4SystemPrompt = `You are an expert career coach. Generate a 300-400 word cover letter based on the user's CV and JD analysis.
RULES:
- Opens with genuine connection to the company (NOT "I am writing to express my interest")
- Maps 2-3 specific applicant experiences to JD requirements
- Addresses the biggest gap from the assessment honestly
- Target the pain points of the job to show impact
- NEVER use em dashes (—). Always use hyphens (-).
Output only the plain text cover letter with no introduction or markdown wrappers.`;

    // Step 3 and 4 Parallel Execution
    const [step3Response, step4Response] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: step3SystemPrompt,
        messages: [
          { role: 'user', content: `Name: ${userProfile.name}\nJD Context: ${JSON.stringify(jdAnalysis)}\nMatch Context: ${JSON.stringify(matchAssessment)}\nUser CV base context: ${userProfile.cv_text}` }
        ]
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: step4SystemPrompt,
        messages: [
          { role: 'user', content: `Name: ${userProfile.name}\nJD Context: ${JSON.stringify(jdAnalysis)}\nMatch Context: ${JSON.stringify(matchAssessment)}\nUser CV base context: ${userProfile.cv_text}` }
        ]
      })
    ]);

    const tailoredCv = (step3Response.content[0] as any).text;
    const coverLetter = (step4Response.content[0] as any).text;

    return NextResponse.json({
      jd_analysis: jdAnalysis,
      match_assessment: matchAssessment,
      tailored_cv: tailoredCv,
      cover_letter: coverLetter
    });

  } catch (error: any) {
    console.error('Claude API Pipeline Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete AI processing pipeline due to Claude API or database failure' }, 
      { status: 500 }
    );
  }
}
