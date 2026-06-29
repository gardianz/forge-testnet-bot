import { describe, it, expect, vi } from 'vitest';
import { supplyStep } from '../src/steps/supply.ts';
import * as evm from '../src/evm.ts';

describe('supplyStep skip-check', () => {
  it('skips when vToken balance > 0 and market entered', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(5n);
    vi.spyOn(evm, 'assetsIn').mockResolvedValue(['0x782E5a6Dc16901ec13D4D1e450A8270F4e6E75cf']);
    const ctx: any = { cfg: { marketToken: 'wsTAO', thresholds: { supplyAmount: '0.4' }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await supplyStep.run(ctx)).status).toBe('skipped');
  });

  it('does not skip when not yet entered', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(0n);
    vi.spyOn(evm, 'assetsIn').mockResolvedValue([]);
    const ctx: any = { cfg: { marketToken: 'wsTAO', thresholds: { supplyAmount: '0.4' }, dryRun: true }, pc: { getChainId: vi.fn().mockResolvedValue(945), simulateContract: vi.fn().mockResolvedValue({ request: {} }) }, wc: { account: {}, writeContract: vi.fn() }, account: { h160: '0x0' }, log: { info() {} } };
    expect((await supplyStep.run(ctx)).status).toBe('done');
  });
});
