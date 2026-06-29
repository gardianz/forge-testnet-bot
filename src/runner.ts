import pino from 'pino';
import { loadAccounts, type Account } from './accounts.ts';
import { connectSubstrate, fillMirrorAddresses } from './substrate.ts';
import { makePublicClient, makeWalletClient } from './evm.ts';
import { loadState, saveStep, type AccountState } from './state.ts';
import type { Config } from './config.ts';
import type { Step, StepContext } from './steps/types.ts';

import { faucetSubstrateStep } from './steps/faucet-substrate.ts';
import { bridgeStep } from './steps/bridge.ts';
import { faucetEvmStep } from './steps/faucet-evm.ts';
import { warpStep } from './steps/warp.ts';
import { supplyStep } from './steps/supply.ts';
import { borrowStep } from './steps/borrow.ts';
import { repayStep } from './steps/repay.ts';
import { redeemStep } from './steps/redeem.ts';

/** Full pipeline order. */
export const STEPS: Step[] = [
  faucetSubstrateStep,
  bridgeStep,
  faucetEvmStep,
  warpStep,
  supplyStep,
  borrowStep,
  repayStep,
  redeemStep,
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run steps in order for one account; stop on the first failure. */
export async function runAccount(ctx: StepContext, steps: Step[] = STEPS): Promise<AccountState> {
  for (const step of steps) {
    try {
      const res = await step.run(ctx);
      saveStep(ctx.account.id, step.name, { status: res.status, tx: res.tx, error: res.error });
      ctx.log.info({ step: step.name, ...res }, 'step result');
      if (res.status === 'failed') break;
    } catch (e) {
      const error = (e as Error).message;
      saveStep(ctx.account.id, step.name, { status: 'failed', error });
      ctx.log.error({ step: step.name, error }, 'step threw');
      break;
    }
    if (ctx.cfg.stepDelayMs) await sleep(ctx.cfg.stepDelayMs);
  }
  return loadState(ctx.account.id);
}

/** Build a per-account StepContext (own clients + shared substrate api). */
function makeCtx(cfg: Config, account: Account, api: Awaited<ReturnType<typeof connectSubstrate>> | null): StepContext {
  return {
    cfg,
    pc: makePublicClient(cfg, account.proxy),
    wc: makeWalletClient(cfg, account),
    api,
    account,
    log: pino({ transport: { target: 'pino-pretty' } }).child({ account: account.id }),
  };
}

/** Concurrency-limited fan-out across accounts. */
export async function runAll(cfg: Config, accounts: Account[]): Promise<AccountState[]> {
  fillMirrorAddresses(accounts, cfg.ss58Format);
  const api = await connectSubstrate(cfg).catch(() => null);
  const results: AccountState[] = [];
  const queue = [...accounts];

  async function worker() {
    for (;;) {
      const account = queue.shift();
      if (!account) return;
      const ctx = makeCtx(cfg, account, api);
      results.push(await runAccount(ctx));
      if (cfg.accountDelayMs) await sleep(cfg.accountDelayMs);
    }
  }

  const pool = Array.from({ length: Math.min(cfg.maxConcurrent, accounts.length) }, () => worker());
  await Promise.all(pool);
  if (api) await api.disconnect();
  return results;
}

export { loadAccounts };
