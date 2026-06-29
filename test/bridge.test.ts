import { describe, it, expect, vi } from 'vitest';
import { bridgeStep } from '../src/steps/bridge.ts';
import * as evm from '../src/evm.ts';

describe('bridgeStep skip-check', () => {
  it('skips when EVM gas balance already sufficient', async () => {
    vi.spyOn(evm, 'nativeBalance').mockResolvedValue(10n ** 18n);
    const ctx: any = { cfg: { thresholds: { minEvmGas: '0.1', minSubstrateTao: '1.0' }, dryRun: true }, pc: {}, api: {}, account: { h160: '0x0', mnemonic: 'm', mirrorSs58: 'x' }, log: { info() {} } };
    expect((await bridgeStep.run(ctx)).status).toBe('skipped');
  });
});
