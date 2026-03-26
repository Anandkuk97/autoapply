// Phase 2: This data will be sent to a Python worker
// (based on GodsScion/Auto_job_applier_linkedIn) that handles
// actual form submission via browser automation

export interface LinkedInApplicationData {
  job_url: string;
  resume_text: string;
  cover_letter_text: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  answers: Record<string, string>;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
}

/**
 * Prepares all data needed to fill a LinkedIn Easy Apply form.
 *
 * Phase 1: Returns a structured JSON object with the applicant's data.
 * Phase 2b: This data will be consumed by a Python browser automation
 * worker that navigates LinkedIn and fills out the Easy Apply form fields.
 *
 * @param jobUrl - The LinkedIn job posting URL
 * @param tailoredCv - The AI-tailored CV text for this specific job
 * @param coverLetter - The AI-generated cover letter text
 * @param userProfile - The applicant's contact details
 * @returns Structured data ready for form submission
 */
export function prepareLinkedInApplication(
  jobUrl: string,
  tailoredCv: string,
  coverLetter: string,
  userProfile: UserProfile
): LinkedInApplicationData {
  return {
    job_url: jobUrl,
    resume_text: tailoredCv,
    cover_letter_text: coverLetter,
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
    location: userProfile.location,
    // Phase 2: Pre-filled answers for common Easy Apply questions
    // These will be populated based on the user's profile and job requirements
    answers: {
      // Common fields that LinkedIn Easy Apply asks:
      // "How many years of experience do you have with X?"
      // "Are you authorized to work in Y?"
      // "What is your expected salary?"
      // "Are you willing to relocate?"
      // These will be dynamically filled by the Python worker
    },
  };
}
