import { describe, it, expect, vi } from 'vitest';
import { repayStep } from '../src/steps/repay.ts';
import * as evm from '../src/evm.ts';

describe('repayStep skip-check', () => {
  it('skips when recycle disabled', async () => {
    const ctx: any = { cfg: { marketToken: 'wsTAO', recycle: false, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await repayStep.run(ctx)).status).toBe('skipped');
  });
  it('skips when no outstanding borrow', async () => {
    vi.spyOn(evm, 'borrowBalance').mockResolvedValue(0n);
    const ctx: any = { cfg: { marketToken: 'wsTAO', recycle: true, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await repayStep.run(ctx)).status).toBe('skipped');
  });
});
