const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const SHOT_DIR = '/tmp/pw-shots';
let shotN = 0;

async function shot(page, name) {
  shotN += 1;
  const fname = `${SHOT_DIR}/${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: fname, fullPage: true }).catch((e) => console.log('SCREENSHOT FAIL', name, e.message));
  console.log('SHOT', fname);
  return fname;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${page.url()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => pageErrors.push(`[${page.url()}] ${err.message}`));
  page.on('requestfailed', (req) => {
    failedRequests.push(`[${page.url()}] ${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      badResponses.push(`[${page.url()}] ${res.request().method()} ${res.url()} -> ${status}`);
    }
  });

  const log = (...args) => console.log(new Date().toISOString(), ...args);
  const report = () => {
    console.log('\n--- running totals ---');
    console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
    console.log('PAGE ERRORS:', JSON.stringify(pageErrors, null, 2));
    console.log('FAILED REQUESTS:', JSON.stringify(failedRequests, null, 2));
    console.log('BAD RESPONSES (>=400):', JSON.stringify(badResponses, null, 2));
  };

  try {
    log('STEP: login flow');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"]', 'dev@bluebox.local');
    await page.fill('input[type="password"], input[name="password"]', 'dev-password');
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Login")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    log('STEP: create project');
    await page.click('button:has-text("New project"), button:has-text("New Project")');
    await page.waitForTimeout(500);
    await page.locator('input').first().fill('PW Onboarding Run');
    await page.click('button:has-text("Create")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'onboarding-landing');
    log('url:', page.url());
  } catch (e) {
    log('SETUP FAILED:', e.message);
    report();
    await browser.close();
    return;
  }

  try {
    log('STEP: submit PRD via template click');
    await page.click('text=Build a SaaS app');
    await shot(page, 'template-selected');
    // handleTemplateClick auto-submits after 600ms
    await page.waitForTimeout(1000);
    await shot(page, 'submitted-processing');
    log('url:', page.url());
  } catch (e) {
    log('SUBMIT STEP FAILED:', e.message);
    await shot(page, 'submit-failed');
  }

  try {
    log('STEP: wait for classification screen (up to 90s)');
    await page.waitForSelector('text=Review PRD Analysis, text=Start Guided Input, text=Build Your Seed', { timeout: 90000 });
    await shot(page, 'classification-ready');
  } catch (e) {
    log('CLASSIFICATION WAIT FAILED:', e.message);
    await shot(page, 'classification-timeout');
    report();
  }

  try {
    log('STEP: click proceed from classification');
    const proceedBtn = page.locator('button:has-text("Review PRD Analysis"), button:has-text("Start Guided Input"), button:has-text("Build Your Seed")').first();
    await proceedBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await shot(page, 'after-classification-proceed');
  } catch (e) {
    log('PROCEED FROM CLASSIFICATION FAILED:', e.message);
    await shot(page, 'proceed-classification-failed');
  }

  // Might be on PRD analysis report screen now (if WELL_FORMED) - wait for PRD analysis to actually be ready if needed
  try {
    log('STEP: wait for PRD analysis report or scale dialogue (up to 60s)');
    await page.waitForSelector('text=PRD Analysis Report, text=Define Your Scale', { timeout: 60000 });
    await shot(page, 'prd-or-scale-ready');
    const bodyText = await page.locator('body').innerText();
    console.log('SNIPPET:', bodyText.slice(0, 300));
  } catch (e) {
    log('WAIT FOR PRD/SCALE FAILED:', e.message);
    await shot(page, 'prd-or-scale-timeout');
  }

  try {
    const proceedToScale = page.locator('button:has-text("Proceed to workspace")').first();
    if (await proceedToScale.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('STEP: click Proceed to workspace (from PRD analysis report)');
      await proceedToScale.click();
      await page.waitForTimeout(1000);
      await shot(page, 'scale-dialogue');
    }
  } catch (e) {
    log('PRD ANALYSIS PROCEED FAILED:', e.message);
  }

  try {
    log('STEP: submit scale dialogue defaults');
    const generateBtn = page.locator('button:has-text("Generate Options")').first();
    await generateBtn.click({ timeout: 5000 });
    log('STEP: wait for hosting options (up to 60s)');
    await page.waitForSelector('text=Hosting Options Matrix', { timeout: 60000 });
    await shot(page, 'hosting-options');
  } catch (e) {
    log('SCALE/HOSTING STEP FAILED:', e.message);
    await shot(page, 'scale-hosting-failed');
  }

  try {
    log('STEP: select first hosting option');
    const selectBtn = page.locator('button:has-text("Select")').first();
    await selectBtn.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, 'after-select-hosting');
    log('url:', page.url());
  } catch (e) {
    log('SELECT HOSTING FAILED:', e.message);
    await shot(page, 'select-hosting-failed');
  }

  report();
  console.log('\nFINAL URL:', page.url());
  await browser.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
