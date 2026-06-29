import { parseUnits } from 'viem';
import { request } from 'undici';
import { ProxyAgent } from 'undici';
import { substrateBalance } from '../substrate.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/** TAO needed on substrate to fund the bridge (transfer + fee headroom), in rao (9dp). */
function needRao(ctx: StepContext): bigint {
  return (
    parseUnits(ctx.cfg.thresholds.minSubstrateTao, 9) +
    parseUnits(ctx.cfg.thresholds.substrateFeeBuffer ?? '0.01', 9)
  );
}

/**
 * Claim the taoswap substrate TAO testnet faucet (https://taoswap.org/testnet-faucet)
 * ONLY when the SS58 free balance can't cover the bridge transfer + fee. Set
 * FORGE_FORCE_FAUCET=1 to bypass the balance gate (live testing).
 *
 * Browser-free. Verified live (2026-06-29) by intercepting the SPA's submit: the
 * page POSTs `{ss58_address, amount, captcha_token}` to
 * `https://api.taoswap.org/testnet-faucet/`, where captcha_token is a Cloudflare
 * Turnstile token (sitekey 0x4AAAAAADsYqTeKzaXU5Qhb). Turnstile is solvable from
 * sitekey+pageurl alone, so the whole claim is just: solve → POST → poll balance.
 * No headless browser needed (works under cron, no chrome system libs).
 */
export const faucetSubstrateStep: Step = {
  name: 'faucet-substrate',
  async run(ctx: StepContext): Promise<StepResult> {
    const force = process.env.FORGE_FORCE_FAUCET === '1';
    if (!force && (await substrateBalance(ctx.api!, ctx.account.ss58)) >= needRao(ctx)) {
      ctx.log.info('faucet-substrate: SS58 balance covers bridge+fee — skipping');
      return { status: 'skipped' };
    }
    if (ctx.cfg.dryRun) return { status: 'done', tx: 'dry-run' };
    try {
      const ok = await claimViaApi(ctx);
      return ok ? { status: 'done' } : { status: 'failed', error: 'faucet claim not confirmed' };
    } catch (e) {
      return { status: 'failed', error: (e as Error).message };
    }
  },
};

async function claimViaApi(ctx: StepContext): Promise<boolean> {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey) {
    ctx.log.warn('faucet-substrate: CAPTCHA_API_KEY unset — cannot solve Turnstile');
    return false;
  }
  const fc = ctx.cfg.substrateFaucet;
  const pageurl = ctx.cfg.substrateFaucetUrl;
  const before = await substrateBalance(ctx.api!, ctx.account.ss58);

  ctx.log.info({ sitekey: fc.sitekey }, 'faucet-substrate: solving Turnstile');
  const provider = ctx.cfg.captcha?.provider ?? '2captcha';
  const token =
    provider === '2captcha'
      ? await solve2captcha(apiKey, 'turnstile', fc.sitekey, pageurl)
      : await solveAnticaptcha(apiKey, 'turnstile', fc.sitekey, pageurl);
  if (!token) return false;

  // POST the claim through the account's proxy, mimicking the SPA's request.
  const dispatcher = ctx.account.proxy ? new ProxyAgent(ctx.account.proxy) : undefined;
  const body = JSON.stringify({ ss58_address: ctx.account.ss58, amount: fc.amount, captcha_token: token });
  ctx.log.info({ api: fc.apiUrl }, 'faucet-substrate: posting claim');
  const res = await request(fc.apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://taoswap.org',
      referer: pageurl,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
    body,
    ...(dispatcher ? { dispatcher } : {}),
  });
  const text = await res.body.text().catch(() => '');
  ctx.log.info({ status: res.statusCode, body: text.slice(0, 300) }, 'faucet-substrate: claim response');
  if (res.statusCode >= 400) return false;

  // Poll the chain for the balance to rise (up to ~2.5 min).
  for (let i = 0; i < 30; i++) {
    const now = await substrateBalance(ctx.api!, ctx.account.ss58);
    if (now > before) {
      ctx.log.info({ gained: (now - before).toString() }, 'faucet-substrate: balance rose — claim confirmed');
      return true;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

async function solve2captcha(key: string, kind: string, sitekey: string, pageurl: string): Promise<string> {
  const method = kind === 'hcaptcha' ? 'hcaptcha' : kind === 'turnstile' ? 'turnstile' : 'userrecaptcha';
  const inUrl = `https://2captcha.com/in.php?key=${key}&method=${method}&sitekey=${sitekey}&pageurl=${encodeURIComponent(pageurl)}&json=1`;
  const inRes = (await (await request(inUrl)).body.json()) as any;
  if (inRes.status !== 1) throw new Error(`2captcha in: ${inRes.request}`);
  const id = inRes.request;
  for (let i = 0; i < 30; i++) {
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
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = (await (await request('https://api.anti-captcha.com/getTaskResult', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientKey: key, taskId: create.taskId }) })).body.json()) as any;
    if (res.status === 'ready') return (res.solution.gRecaptchaResponse || res.solution.token) as string;
  }
  throw new Error('anticaptcha timeout');
}
