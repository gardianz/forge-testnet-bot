import { loadAccounts, type Account } from './accounts.ts';
import { connectSubstrate, fillMirrorAddresses } from './substrate.ts';
import { makePublicClient, makeWalletClient } from './evm.ts';
import { loadState, saveStep, type AccountState } from './state.ts';
import { fetchBalances } from './balances.ts';
import { Dashboard, makeLogger } from './dashboard.ts';
import type { Config } from './config.ts';
import type { ApiPromise } from '@polkadot/api';
import type { Step, StepContext } from './steps/types.ts';

import { faucetDevnetStep } from './steps/faucet-devnet.ts';
import { faucetSubstrateStep } from './steps/faucet-substrate.ts';
import { bridgeStep } from './steps/bridge.ts';
import { warpStep } from './steps/warp.ts';
import { supplyStep } from './steps/supply.ts';
import { collateralStep } from './steps/collateral.ts';
import { borrowStep } from './steps/borrow.ts';
import { repayStep } from './steps/repay.ts';
import { redeemStep } from './steps/redeem.ts';

/**
 * Single daily pipeline. Faucet steps run inline (not as a separate bot):
 *   - faucet-devnet  : claim the Forge devnet faucet daily (mint mock tokens).
 *   - faucet-substrate: claim taoswap TAO only when the SS58 balance can't cover
 *     the bridge fee.
 * Then the lending loop: bridge -> warp -> supply -> collateral -> borrow ->
 * repay -> redeem. Every step is idempotent and skips when already satisfied.
 */
export const STEPS: Step[] = [
  faucetDevnetStep,
  faucetSubstrateStep,
  bridgeStep,
  warpStep,
  supplyStep,
  collateralStep,
  borrowStep,
  repayStep,
  redeemStep,
];

export const STEP_NAMES = STEPS.map((s) => s.name);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run steps in order for one account; stop on the first failure. */
export async function runAccount(ctx: StepContext, steps: Step[] = STEPS, dash?: Dashboard | null): Promise<AccountState> {
  for (const step of steps) {
    dash?.stepStart(ctx.account.id, step.name);
    try {
      const res = await step.run(ctx);
      saveStep(ctx.account.id, step.name, { status: res.status, tx: res.tx, error: res.error });
      dash?.stepEnd(ctx.account.id, step.name, res.status);
      ctx.log.info({ step: step.name, ...res }, `${step.name}: ${res.status}${res.tx ? ' ' + res.tx : ''}`);
      if (res.status === 'failed') break;
    } catch (e) {
      const error = (e as Error).message;
      saveStep(ctx.account.id, step.name, { status: 'failed', error });
      dash?.stepEnd(ctx.account.id, step.name, 'failed');
      ctx.log.error({ step: step.name, error }, `${step.name}: threw — ${error.split('\n')[0]}`);
      break;
    }
    if (ctx.cfg.stepDelayMs) await sleep(ctx.cfg.stepDelayMs);
  }
  return loadState(ctx.account.id);
}

/** Build a per-account StepContext (own clients + shared substrate api). */
export function makeCtx(cfg: Config, account: Account, api: ApiPromise | null, dash?: Dashboard | null): StepContext {
  return {
    cfg,
    pc: makePublicClient(cfg, account.proxy),
    wc: makeWalletClient(cfg, account),
    api,
    account,
    log: makeLogger(dash ?? null, account.id),
  };
}

/** Concurrency-limited fan-out across accounts, running `steps` per account. */
export async function runAll(
  cfg: Config,
  accounts: Account[],
  steps: Step[] = STEPS,
  dash?: Dashboard | null,
): Promise<AccountState[]> {
  fillMirrorAddresses(accounts, cfg.ss58Format);
  for (const a of accounts) dash?.setProxy(a.id, a.proxy ?? '');
  const api = await connectSubstrate(cfg).catch(() => null);
  const results: AccountState[] = [];
  const queue = [...accounts];
  // Shuffle when jitter is on so accounts don't always run in the same order.
  if (cfg.accountJitterMs) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }

  async function worker() {
    for (;;) {
      const account = queue.shift();
      if (!account) return;
      const ctx = makeCtx(cfg, account, api, dash);
      if (dash) await fetchBalances(cfg, account, api, ctx.pc).then((b) => dash.setBalances(account.id, b)).catch(() => undefined);
      results.push(await runAccount(ctx, steps, dash));
      if (dash) await fetchBalances(cfg, account, api, ctx.pc).then((b) => dash.setBalances(account.id, b)).catch(() => undefined);
      const extra = cfg.accountJitterMs ? Math.floor(Math.random() * cfg.accountJitterMs) : 0;
      if (cfg.accountDelayMs || extra) await sleep(cfg.accountDelayMs + extra);
    }
  }

  const pool = Array.from({ length: Math.min(cfg.maxConcurrent, accounts.length) }, () => worker());
  await Promise.all(pool);
  if (api) await api.disconnect();
  return results;
}

export { loadAccounts };
