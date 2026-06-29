import { parseUnits, parseAbi } from 'viem';
import { execWrite } from './executor.ts';
import { loadState } from '../state.ts';
import type { Step, StepContext, StepResult } from './types.ts';

const mintAbi = parseAbi(['function mint(address to, uint256 amount)']);

/** True when `iso` falls on the current UTC calendar day. */
function sameUtcDay(iso?: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

/**
 * Claim the Forge devnet faucet (the on-chain mint cards on
 * https://testnet.forge.endure.network/#/devnet-faucet?chainId=945). Each mock
 * token exposes an open `mint(address,uint256)`; this mints `amount` of every
 * configured token to the account's H160.
 *
 * Daily-gated: skips if a non-failed run already happened today (UTC), so it's
 * safe to run every pipeline pass but only fires once per day. Each token is
 * simulate-guarded by execWrite, so a token that isn't open-mint just fails its
 * own simulation (logged, no broadcast, no gas) without aborting the rest.
 */
export const faucetDevnetStep: Step = {
  name: 'faucet-devnet',
  async run(ctx: StepContext): Promise<StepResult> {
    const f = ctx.cfg.faucetDevnet;
    if (!f || f.tokens.length === 0) {
      ctx.log.warn('faucet-devnet: no tokens configured — skipping');
      return { status: 'skipped' };
    }

    const prev = loadState(ctx.account.id).steps['faucet-devnet'];
    if (prev && prev.status !== 'failed' && sameUtcDay(prev.at)) {
      ctx.log.info('faucet-devnet: already claimed today');
      return { status: 'skipped' };
    }

    let ok = 0;
    let lastTx: string | undefined;
    const failed: string[] = [];
    for (const t of f.tokens) {
      const amount = parseUnits(t.amount ?? f.amount, t.decimals ?? 18);
      try {
        const tx = await execWrite(ctx, {
          address: t.address as `0x${string}`,
          abi: mintAbi,
          functionName: 'mint',
          args: [ctx.account.h160, amount],
        });
        ok++;
        lastTx = tx;
        ctx.log.info({ token: t.symbol, amount: t.amount ?? f.amount, tx }, `faucet-devnet: minted ${t.symbol}`);
      } catch (e) {
        failed.push(t.symbol);
        ctx.log.warn({ token: t.symbol, err: (e as Error).message.split('\n')[0] }, `faucet-devnet: ${t.symbol} not open-mint — skipped`);
      }
      if (ctx.cfg.stepDelayMs) await new Promise((r) => setTimeout(r, Math.min(ctx.cfg.stepDelayMs, 1500)));
    }

    if (ok === 0) return { status: 'failed', error: `all faucet mints failed: ${failed.join(', ')}` };
    return { status: 'done', tx: lastTx };
  },
};
