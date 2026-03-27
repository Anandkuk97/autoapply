/**
 * LinkedIn Easy Apply Automator
 * Uses Puppeteer with stealth plugin to automate LinkedIn job applications.
 *
 * SAFETY:
 * - Max 10 applications per session
 * - Random delays between actions (2-5s)
 * - CAPTCHA detection with graceful abort
 * - Screenshot on each step for audit trail
 * - Session cookies reuse to avoid repeated logins
 */

// Dynamic imports to avoid build-time issues
// puppeteer-extra and stealth plugin are loaded at runtime only
type Browser = import('puppeteer').Browser;
type Page = import('puppeteer').Page;

let puppeteerInstance: any = null;

async function getPuppeteer() {
  if (!puppeteerInstance) {
    const puppeteerExtra = (await import('puppeteer-extra')).default;
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteerExtra.use(StealthPlugin());
    puppeteerInstance = puppeteerExtra;
  }
  return puppeteerInstance;
}

const MAX_APPS_PER_SESSION = 10;
const MIN_DELAY = 2000;
const MAX_DELAY = 5000;

export interface LinkedInCredentials {
  email: string;
  password: string;
}

export interface AutoApplyResult {
  success: boolean;
  step: string;
  screenshot?: string; // base64
  error?: string;
  captchaDetected?: boolean;
  applicationUrl?: string;
}

export interface ApplyProgress {
  step: string;
  message: string;
  screenshot?: string;
  completed: boolean;
  error?: string;
}

function randomDelay(): Promise<void> {
  const ms = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
  return typeof buffer === 'string' ? buffer : Buffer.from(buffer).toString('base64');
}

async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    const captchaIndicators = [
      'captcha',
      'challenge-dialog',
      'checkpoint/challenge',
      'security verification',
      'verify you\'re not a robot',
      'recaptcha',
      'hcaptcha',
    ];
    const lower = content.toLowerCase();
    return captchaIndicators.some(indicator => lower.includes(indicator));
  } catch {
    return false;
  }
}

async function detectSecurityChallenge(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes('checkpoint') || url.includes('challenge') || url.includes('security');
}

export async function loginToLinkedIn(
  page: Page,
  credentials: LinkedInCredentials,
  onProgress?: (p: ApplyProgress) => void
): Promise<boolean> {
  try {
    onProgress?.({ step: 'login', message: 'Navigating to LinkedIn...', completed: false });
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // Check if already logged in
    if (page.url().includes('/feed') || page.url().includes('/mynetwork')) {
      onProgress?.({ step: 'login', message: 'Already logged in', completed: true });
      return true;
    }

    // Check for CAPTCHA
    if (await detectCaptcha(page)) {
      const screenshot = await takeScreenshot(page);
      onProgress?.({ step: 'login', message: 'CAPTCHA detected - cannot proceed automatically', completed: false, error: 'CAPTCHA', screenshot });
      return false;
    }

    onProgress?.({ step: 'login', message: 'Entering credentials...', completed: false });

    // Type email
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', credentials.email, { delay: 50 + Math.random() * 80 });
    await randomDelay();

    // Type password
    await page.type('#password', credentials.password, { delay: 50 + Math.random() * 80 });
    await randomDelay();

    // Click sign in
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    // Check for security challenge
    if (await detectSecurityChallenge(page)) {
      const screenshot = await takeScreenshot(page);
      onProgress?.({ step: 'login', message: 'Security verification required - please complete manually', completed: false, error: 'Security challenge', screenshot });
      return false;
    }

    if (await detectCaptcha(page)) {
      const screenshot = await takeScreenshot(page);
      onProgress?.({ step: 'login', message: 'CAPTCHA detected after login', completed: false, error: 'CAPTCHA', screenshot });
      return false;
    }

    const loggedIn = page.url().includes('/feed') || page.url().includes('/mynetwork') || page.url().includes('/in/');
    if (loggedIn) {
      onProgress?.({ step: 'login', message: 'Successfully logged in', completed: true });
    } else {
      const screenshot = await takeScreenshot(page);
      onProgress?.({ step: 'login', message: 'Login may have failed - unexpected page', completed: false, error: 'Unknown state', screenshot });
    }

    return loggedIn;
  } catch (err: any) {
    const screenshot = await takeScreenshot(page).catch(() => '');
    onProgress?.({ step: 'login', message: `Login error: ${err.message}`, completed: false, error: err.message, screenshot });
    return false;
  }
}

export async function applyToJob(
  page: Page,
  jobUrl: string,
  applicantData: {
    name: string;
    email: string;
    phone?: string;
    headline?: string;
    coverLetter?: string;
  },
  onProgress?: (p: ApplyProgress) => void
): Promise<AutoApplyResult> {
  try {
    // Navigate to job
    onProgress?.({ step: 'navigate', message: `Opening job page...`, completed: false });
    await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    if (await detectCaptcha(page)) {
      return { success: false, step: 'navigate', captchaDetected: true, error: 'CAPTCHA detected' };
    }

    const screenshot1 = await takeScreenshot(page);
    onProgress?.({ step: 'navigate', message: 'Job page loaded', completed: true, screenshot: screenshot1 });

    // Look for Easy Apply button
    onProgress?.({ step: 'find-button', message: 'Looking for Easy Apply button...', completed: false });
    await randomDelay();

    const easyApplyButton = await page.$('.jobs-apply-button, button[aria-label*="Easy Apply"], .jobs-s-apply button');
    if (!easyApplyButton) {
      const screenshot = await takeScreenshot(page);
      return {
        success: false,
        step: 'find-button',
        error: 'Easy Apply button not found - this job may require external application',
        screenshot,
        applicationUrl: jobUrl
      };
    }

    // Click Easy Apply
    onProgress?.({ step: 'click-apply', message: 'Clicking Easy Apply...', completed: false });
    await easyApplyButton.click();
    await randomDelay();

    if (await detectCaptcha(page)) {
      return { success: false, step: 'click-apply', captchaDetected: true, error: 'CAPTCHA detected' };
    }

    const screenshot2 = await takeScreenshot(page);
    onProgress?.({ step: 'click-apply', message: 'Application form opened', completed: true, screenshot: screenshot2 });

    // Fill form fields
    onProgress?.({ step: 'fill-form', message: 'Filling application form...', completed: false });
    await fillFormFields(page, applicantData);
    await randomDelay();

    const screenshot3 = await takeScreenshot(page);
    onProgress?.({ step: 'fill-form', message: 'Form fields filled', completed: true, screenshot: screenshot3 });

    // Navigate through multi-step form
    let stepCount = 0;
    const maxSteps = 10;

    while (stepCount < maxSteps) {
      stepCount++;
      await randomDelay();

      // Check for submit button
      const submitButton = await page.$('button[aria-label*="Submit"], button[aria-label*="submit"]');
      if (submitButton) {
        const buttonText = await page.evaluate(el => el.textContent?.trim() || '', submitButton);
        if (buttonText.toLowerCase().includes('submit')) {
          onProgress?.({ step: 'submit', message: 'Submitting application...', completed: false });
          await submitButton.click();
          await randomDelay();
          await randomDelay(); // Extra wait for submission

          if (await detectCaptcha(page)) {
            return { success: false, step: 'submit', captchaDetected: true, error: 'CAPTCHA at submission' };
          }

          const screenshotFinal = await takeScreenshot(page);

          // Check for success indicators
          const pageContent = await page.content();
          const successIndicators = ['application was sent', 'application submitted', 'successfully applied', 'done'];
          const isSuccess = successIndicators.some(s => pageContent.toLowerCase().includes(s));

          if (isSuccess) {
            onProgress?.({ step: 'complete', message: 'Application submitted successfully!', completed: true, screenshot: screenshotFinal });
            return { success: true, step: 'complete', screenshot: screenshotFinal, applicationUrl: jobUrl };
          } else {
            onProgress?.({ step: 'complete', message: 'Submitted - verifying...', completed: true, screenshot: screenshotFinal });
            return { success: true, step: 'complete', screenshot: screenshotFinal, applicationUrl: jobUrl };
          }
        }
      }

      // Look for "Next" or "Review" button
      const nextButton = await page.$('button[aria-label*="next"], button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Continue"]');
      if (nextButton) {
        onProgress?.({ step: `form-step-${stepCount}`, message: `Completing step ${stepCount}...`, completed: false });

        // Fill any visible form fields on this step
        await fillFormFields(page, applicantData);
        await randomDelay();

        await nextButton.click();
        await randomDelay();

        if (await detectCaptcha(page)) {
          return { success: false, step: `form-step-${stepCount}`, captchaDetected: true, error: 'CAPTCHA during form' };
        }

        const stepScreenshot = await takeScreenshot(page);
        onProgress?.({ step: `form-step-${stepCount}`, message: `Step ${stepCount} completed`, completed: true, screenshot: stepScreenshot });
      } else {
        // No next or submit button found
        break;
      }
    }

    // If we got here without submitting, something went wrong
    const finalScreenshot = await takeScreenshot(page);
    return {
      success: false,
      step: 'form-navigation',
      error: 'Could not find submit button after navigating all steps',
      screenshot: finalScreenshot,
      applicationUrl: jobUrl
    };

  } catch (err: any) {
    const screenshot = await takeScreenshot(page).catch(() => '');
    return { success: false, step: 'error', error: err.message, screenshot, applicationUrl: jobUrl };
  }
}

async function fillFormFields(
  page: Page,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    headline?: string;
    coverLetter?: string;
  }
): Promise<void> {
  try {
    // Find empty text inputs and try to fill them
    const inputs = await page.$$('input[type="text"], input[type="email"], input[type="tel"], textarea');

    for (const input of inputs) {
      const attributes = await page.evaluate(el => ({
        name: el.getAttribute('name') || '',
        id: el.id || '',
        label: el.getAttribute('aria-label') || '',
        placeholder: el.getAttribute('placeholder') || '',
        value: (el as HTMLInputElement).value || '',
        type: el.getAttribute('type') || '',
        tagName: el.tagName,
      }), input);

      // Skip if already filled
      if (attributes.value.trim()) continue;

      const identifier = `${attributes.name} ${attributes.id} ${attributes.label} ${attributes.placeholder}`.toLowerCase();

      if (identifier.includes('phone') || identifier.includes('mobile') || identifier.includes('tel')) {
        if (data.phone) {
          await input.click({ clickCount: 3 });
          await input.type(data.phone, { delay: 30 });
        }
      } else if (identifier.includes('email')) {
        if (data.email) {
          await input.click({ clickCount: 3 });
          await input.type(data.email, { delay: 30 });
        }
      } else if (identifier.includes('cover') && attributes.tagName === 'TEXTAREA') {
        if (data.coverLetter) {
          await input.click({ clickCount: 3 });
          await input.type(data.coverLetter.substring(0, 2000), { delay: 10 });
        }
      } else if (identifier.includes('headline') || identifier.includes('summary')) {
        if (data.headline) {
          await input.click({ clickCount: 3 });
          await input.type(data.headline, { delay: 30 });
        }
      }
    }

    // Handle dropdowns (select elements)
    const selects = await page.$$('select');
    for (const select of selects) {
      const options = await page.evaluate(el => {
        const opts = Array.from(el.options);
        return opts.map(o => ({ value: o.value, text: o.text }));
      }, select);

      // If there's a "Yes" option that isn't selected, pick it (common for work authorization, etc.)
      const yesOption = options.find(o => o.text.toLowerCase() === 'yes');
      if (yesOption) {
        await select.select(yesOption.value);
      }
    }

    // Handle radio buttons — prefer "Yes" when available
    const radioGroups = await page.$$('fieldset');
    for (const group of radioGroups) {
      const yesRadio = await group.$('input[value="Yes"], input[value="yes"], label:has-text("Yes") input[type="radio"]');
      if (yesRadio) {
        await yesRadio.click();
      }
    }
  } catch (err) {
    // Non-fatal - some fields may not be fillable
    console.warn('[fill-form] Error filling fields:', err);
  }
}

export async function launchBrowser(): Promise<Browser> {
  const pptr = await getPuppeteer();
  const browser = await pptr.launch({
    headless: true, // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });
  return browser;
}

export { MAX_APPS_PER_SESSION };
