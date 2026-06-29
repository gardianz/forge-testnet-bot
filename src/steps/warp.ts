import { parseEther } from 'viem';
import { erc20Balance, nativeBalance } from '../evm.ts';
import { execWrite } from './executor.ts';
import { ADDRESSES, wstaoAbi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Warp = wrap NATIVE TAO into wsTAO. Verified live: wsTAO.wrap is payable
 * `wrap(uint256 minSharesOut, uint256 deadline)` — you send TAO as msg.value and
 * receive wsTAO shares (exchangeRate ~1.0001). No WTAO/approve involved.
 * minSharesOut=0 (accept any) on testnet; deadline = now + 10 min.
 */
export const warpStep: Step = {
  name: 'warp',
  async run(ctx: StepContext): Promise<StepResult> {
    const want = parseEther(ctx.cfg.thresholds.warpAmount); // native TAO to wrap
    const ws = await erc20Balance(ctx.pc, ADDRESSES.wsTAO, ctx.account.h160);
    if (ws >= want) {
      ctx.log.info({ wsTAO: ws.toString() }, 'warp: wsTAO balance already sufficient');
      return { status: 'skipped' };
    }
    // Already supplied (wsTAO consumed into vWsTAO) -> nothing to warp.
    const v = await erc20Balance(ctx.pc, ADDRESSES.vWsTAO, ctx.account.h160);
    if (v > 0n) {
      ctx.log.info('warp: already supplied (vWsTAO > 0)');
      return { status: 'skipped' };
    }
    // Guard: wrapping spends native TAO as msg.value. Fail gracefully (not a raw
    // OutOfFund revert) when the account can't cover the amount + gas headroom.
    const gas = await nativeBalance(ctx.pc, ctx.account.h160);
    if (gas <= want) {
      return { status: 'failed', error: `insufficient native TAO to warp: have ${gas}, need > ${want} (+gas)` };
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const tx = await execWrite(ctx, { address: ADDRESSES.wsTAO, abi: wstaoAbi, functionName: 'wrap', args: [0n, deadline], value: want });
    return { status: 'done', tx };
  },
};
