import { describe, it, expect, vi } from 'vitest';
import { borrowStep } from '../src/steps/borrow.ts';
import * as evm from '../src/evm.ts';

describe('borrowStep skip-check', () => {
  it('skips when an outstanding borrow already exists', async () => {
    vi.spyOn(evm, 'borrowBalance').mockResolvedValue(1n);
    const ctx: any = { cfg: { marketToken: 'wsTAO', thresholds: { borrowFraction: 0.3 }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await borrowStep.run(ctx)).status).toBe('skipped');
  });

  it('fails when there is no borrow liquidity', async () => {
    vi.spyOn(evm, 'borrowBalance').mockResolvedValue(0n);
    vi.spyOn(evm, 'accountLiquidity').mockResolvedValue(0n);
    const ctx: any = { cfg: { marketToken: 'wsTAO', thresholds: { borrowFraction: 0.3 }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await borrowStep.run(ctx)).status).toBe('failed');
  });
});
