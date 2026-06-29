import { describe, it, expect, vi } from 'vitest';
import { redeemStep } from '../src/steps/redeem.ts';
import * as evm from '../src/evm.ts';

describe('redeemStep skip-check', () => {
  it('skips when recycle disabled', async () => {
    const ctx: any = { cfg: { marketToken: 'wsTAO', recycle: false, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await redeemStep.run(ctx)).status).toBe('skipped');
  });
  it('skips when no vToken balance', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(0n);
    const ctx: any = { cfg: { marketToken: 'wsTAO', recycle: true, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await redeemStep.run(ctx)).status).toBe('skipped');
  });
});
