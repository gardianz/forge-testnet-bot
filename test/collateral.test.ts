import { describe, it, expect, vi } from 'vitest';
import { collateralStep } from '../src/steps/collateral.ts';
import * as evm from '../src/evm.ts';

describe('collateralStep skip-check', () => {
  it('skips when not configured', async () => {
    const ctx: any = { cfg: {}, pc: {}, wc: {}, account: { h160: '0x0' }, log: { warn() {}, info() {} } };
    expect((await collateralStep.run(ctx)).status).toBe('skipped');
  });
  it('skips when collateral already supplied + entered', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(5n);
    vi.spyOn(evm, 'assetsIn').mockResolvedValue(['0x037b37b4523c5f5d5291460d01a53778f9d7d6c3']);
    const ctx: any = { cfg: { collateral: { underlying: '0xu', vToken: '0x037b37B4523C5f5D5291460d01a53778f9d7D6c3', mintAmount: '10', supplyAmount: '5' } }, pc: {}, wc: {}, account: { h160: '0x0' }, log: { info() {} } };
    expect((await collateralStep.run(ctx)).status).toBe('skipped');
  });
});
