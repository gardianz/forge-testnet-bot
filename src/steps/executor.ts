import { assertChainId } from '../contracts.ts';
import type { StepContext } from './types.ts';

export type WriteCall = {
  address: `0x${string}`;
  abi: any;
  functionName: string;
  args: any[];
  value?: bigint;
};

/**
 * Simulate then (unless dryRun) broadcast and wait for a contract write.
 * Asserts the connected chain is 945 before doing anything. Returns the tx hash,
 * or the literal 'dry-run' when cfg.dryRun is set.
 */
export async function execWrite(ctx: Pick<StepContext, 'cfg' | 'pc' | 'wc'>, call: WriteCall): Promise<string> {
  assertChainId(await ctx.pc.getChainId());
  const { request } = await ctx.pc.simulateContract({
    account: ctx.wc.account,
    address: call.address,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
    ...(call.value !== undefined ? { value: call.value } : {}),
  } as any);
  if (ctx.cfg.dryRun) return 'dry-run';
  const hash = (await ctx.wc.writeContract(request as any)) as `0x${string}`;
  await ctx.pc.waitForTransactionReceipt({ hash });
  return hash;
}
