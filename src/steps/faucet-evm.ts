import { parseEther, parseAbi } from 'viem';
import { erc20Balance } from '../evm.ts';
import { execWrite } from './executor.ts';
import { ADDRESSES } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

const mintAbi = parseAbi(['function mint(address to, uint256 amount)']);

/**
 * Claim the EVM Bittensor faucet on the Forge site = mint the mock collateral
 * token. Verified live: WTAO (`0x757b…`) exposes an open `mint(address,uint256)`
 * on testnet. Mints `cfg.evmFaucet.amount` WTAO to the account's H160 so the
 * warp/supply steps have something to wrap. Skips when the balance already meets
 * the target. Disable by omitting `cfg.evmFaucet`.
 */
export const faucetEvmStep: Step = {
  name: 'faucet-evm',
  async run(ctx: StepContext): Promise<StepResult> {
    const f = ctx.cfg.evmFaucet;
    if (!f) {
      ctx.log.warn('faucet-evm: no evmFaucet configured — skipping');
      return { status: 'skipped' };
    }
    const token = (f.token ?? ADDRESSES.WTAO) as `0x${string}`;
    const amount = parseEther(f.amount);
    const have = await erc20Balance(ctx.pc, token, ctx.account.h160);
    if (have >= amount) {
      ctx.log.info({ have: have.toString() }, 'faucet-evm: token balance already sufficient');
      return { status: 'skipped' };
    }
    const tx = await execWrite(ctx, { address: token, abi: mintAbi, functionName: 'mint', args: [ctx.account.h160, amount] });
    return { status: 'done', tx };
  },
};
