import { describe, it, expect, vi } from 'vitest';
import { faucetEvmStep } from '../src/steps/faucet-evm.ts';
import * as evm from '../src/evm.ts';

describe('faucetEvmStep', () => {
  it('skips when gas already sufficient', async () => {
    vi.spyOn(evm, 'nativeBalance').mockResolvedValue(10n ** 18n);
    const ctx: any = { cfg: { thresholds: { minEvmGas: '0.1' }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0xabc' }, log: { info() {} } };
    expect((await faucetEvmStep.run(ctx)).status).toBe('skipped');
  });

  it('skips with a note when no faucet is configured', async () => {
    vi.spyOn(evm, 'nativeBalance').mockResolvedValue(0n);
    const ctx: any = { cfg: { thresholds: { minEvmGas: '0.1' }, dryRun: true }, pc: {}, wc: {}, account: { h160: '0xabc' }, log: { warn() {}, info() {} } };
    const r = await faucetEvmStep.run(ctx);
    expect(r.status).toBe('skipped');
  });

  it('calls the configured faucet contract when gas is low', async () => {
    vi.spyOn(evm, 'nativeBalance').mockResolvedValue(0n);
    const ctx: any = {
      cfg: { thresholds: { minEvmGas: '0.1' }, dryRun: false, evmFaucet: { address: '0xfauc', method: 'faucet', passAddress: false } },
      pc: { getChainId: vi.fn().mockResolvedValue(945), simulateContract: vi.fn().mockResolvedValue({ request: {} }), waitForTransactionReceipt: vi.fn().mockResolvedValue({}) },
      wc: { account: {}, writeContract: vi.fn().mockResolvedValue('0xhash') },
      account: { h160: '0xabc' }, log: { info() {} },
    };
    expect((await faucetEvmStep.run(ctx)).status).toBe('done');
  });
});
