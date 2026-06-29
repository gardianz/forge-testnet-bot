import { describe, it, expect, vi } from 'vitest';
import { warpStep } from '../src/steps/warp.ts';
import * as evm from '../src/evm.ts';

describe('warpStep skip-check', () => {
  it('skips when wsTAO balance already meets threshold', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(10n ** 18n); // 1.0
    const ctx: any = { cfg: { thresholds: { warpAmount: '0.5' }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await warpStep.run(ctx)).status).toBe('skipped');
  });
});
