import { parseUnits } from 'viem';
import { request } from 'undici';
import { substrateBalance } from '../substrate.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Claim the taoswap substrate TAO testnet faucet. The faucet is a captcha-gated
 * SPA, so this drives it with a headless browser (through the account proxy) and
 * solves the captcha via a solver service (CAPTCHA_API_KEY + cfg.captcha.provider).
 *
 * The page selectors + captcha sitekey are NOT yet confirmed (live-tuning item,
 * see forge-live-notes.md). The skip-check and dry-run paths are fully wired; the
 * browser path is best-effort and logs what it could not find.
 */
export const faucetSubstrateStep: Step = {
  name: 'faucet-substrate',
  async run(ctx: StepContext): Promise<StepResult> {
    const want = parseUnits(ctx.cfg.thresholds.minSubstrateTao, 9); // TAO = 9 decimals on substrate
    if ((await substrateBalance(ctx.api!, ctx.account.ss58)) >= want) {
      ctx.log.info('faucet-substrate: SS58 balance already sufficient');
      return { status: 'skipped' };
    }
    if (ctx.cfg.dryRun) return { status: 'done', tx: 'dry-run' };
    try {
      const ok = await claimViaBrowser(ctx);
      return ok ? { status: 'done' } : { status: 'failed', error: 'faucet claim not confirmed' };
    } catch (e) {
      return { status: 'failed', error: (e as Error).message };
    }
  },
};

async function claimViaBrowser(ctx: StepContext): Promise<boolean> {
  const { chromium } = await import('playwright'); // lazy: keeps unit tests light
  const proxy = ctx.account.proxy ? { server: ctx.account.proxy } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  try {
    const page = await browser.newPage();
    await page.goto(ctx.cfg.substrateFaucetUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // Fill the SS58 address. Selectors are best-guess — adjust after inspecting
    // the live page (input[placeholder*=address], input[type=text], etc.).
    const input = page.locator('input[type="text"], input[placeholder*="address" i]').first();
    await input.fill(ctx.account.ss58, { timeout: 15000 });

    // Detect a captcha widget and solve it.
    const token = await solveCaptcha(ctx, page);
    if (token) {
      await page.evaluate((t) => {
        const ta = document.querySelector('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]') as HTMLTextAreaElement | HTMLInputElement | null;
        if (ta) (ta as any).value = t;
      }, token);
    }

    // Submit. Adjust the selector to the live "Claim"/"Request" button.
    await page.locator('button:has-text("Claim"), button:has-text("Request"), button[type="submit"]').first().click({ timeout: 15000 });

    // Poll the chain for the balance to rise (up to ~2 min).
    const want = parseUnits(ctx.cfg.thresholds.minSubstrateTao, 9);
    for (let i = 0; i < 24; i++) {
      if ((await substrateBalance(ctx.api!, ctx.account.ss58)) >= want) return true;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  } finally {
    await browser.close();
  }
}

/**
 * Solve the page captcha with 2captcha (default) or anticaptcha. Reads the
 * sitekey from the captcha iframe and returns a response token, or '' if no
 * captcha / no API key. The provider request shapes follow each service's docs.
 */
async function solveCaptcha(ctx: StepContext, page: any): Promise<string> {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey) {
    ctx.log.warn('faucet-substrate: CAPTCHA_API_KEY unset — skipping captcha solve');
    return '';
  }
  const frame = await page.$('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[src*="turnstile"]');
  if (!frame) return '';
  const src: string = await frame.getAttribute('src');
  const sitekey = new URL(src).searchParams.get('sitekey') || new URL(src).searchParams.get('k') || '';
  const pageurl = ctx.cfg.substrateFaucetUrl;
  const kind = src.includes('hcaptcha') ? 'hcaptcha' : src.includes('turnstile') ? 'turnstile' : 'recaptcha';

  const provider = ctx.cfg.captcha?.provider ?? '2captcha';
  if (provider === '2captcha') return solve2captcha(apiKey, kind, sitekey, pageurl);
  return solveAnticaptcha(apiKey, kind, sitekey, pageurl);
}

async function solve2captcha(key: string, kind: string, sitekey: string, pageurl: string): Promise<string> {
  const method = kind === 'hcaptcha' ? 'hcaptcha' : kind === 'turnstile' ? 'turnstile' : 'userrecaptcha';
  const inUrl = `https://2captcha.com/in.php?key=${key}&method=${method}&sitekey=${sitekey}&pageurl=${encodeURIComponent(pageurl)}&json=1`;
  const inRes = (await (await request(inUrl)).body.json()) as any;
  if (inRes.status !== 1) throw new Error(`2captcha in: ${inRes.request}`);
  const id = inRes.request;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const out = (await (await request(`https://2captcha.com/res.php?key=${key}&action=get&id=${id}&json=1`)).body.json()) as any;
    if (out.status === 1) return out.request as string;
    if (out.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha res: ${out.request}`);
  }
  throw new Error('2captcha timeout');
}

async function solveAnticaptcha(key: string, kind: string, sitekey: string, pageurl: string): Promise<string> {
  const type = kind === 'hcaptcha' ? 'HCaptchaTaskProxyless' : kind === 'turnstile' ? 'TurnstileTaskProxyless' : 'RecaptchaV2TaskProxyless';
  const createBody = { clientKey: key, task: { type, websiteURL: pageurl, websiteKey: sitekey } };
  const create = (await (await request('https://api.anti-captcha.com/createTask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(createBody) })).body.json()) as any;
  if (create.errorId) throw new Error(`anticaptcha create: ${create.errorDescription}`);
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = (await (await request('https://api.anti-captcha.com/getTaskResult', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientKey: key, taskId: create.taskId }) })).body.json()) as any;
    if (res.status === 'ready') return (res.solution.gRecaptchaResponse || res.solution.token) as string;
  }
  throw new Error('anticaptcha timeout');
}
