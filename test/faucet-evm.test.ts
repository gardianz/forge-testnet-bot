import { describe, it, expect, vi } from 'vitest';
import { faucetEvmStep } from '../src/steps/faucet-evm.ts';
import * as evm from '../src/evm.ts';

describe('faucetEvmStep', () => {
  it('skips when no faucet configured', async () => {
    const ctx: any = { cfg: {}, pc: {}, wc: {}, account: { h160: '0xabc' }, log: { warn() {}, info() {} } };
    expect((await faucetEvmStep.run(ctx)).status).toBe('skipped');
  });

  it('skips when token balance already sufficient', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(10n ** 18n * 10n);
    const ctx: any = { cfg: { evmFaucet: { amount: '5' }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0xabc' }, log: { info() {} } };
    expect((await faucetEvmStep.run(ctx)).status).toBe('skipped');
  });

  it('mints when balance is low', async () => {
    vi.spyOn(evm, 'erc20Balance').mockResolvedValue(0n);
    const ctx: any = {
      cfg: { evmFaucet: { amount: '5' }, dryRun: false },
      pc: { getChainId: vi.fn().mockResolvedValue(945), simulateContract: vi.fn().mockResolvedValue({ request: {} }), waitForTransactionReceipt: vi.fn().mockResolvedValue({}) },
      wc: { account: {}, writeContract: vi.fn().mockResolvedValue('0xhash') },
      account: { h160: '0xabc' }, log: { info() {} },
    };
    expect((await faucetEvmStep.run(ctx)).status).toBe('done');
  });
});
