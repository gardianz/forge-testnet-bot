import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/substrate.ts', () => ({ substrateBalance: vi.fn().mockResolvedValue(10n ** 12n) }));
import { faucetSubstrateStep } from '../src/steps/faucet-substrate.ts';

describe('faucetSubstrateStep skip-check', () => {
  it('skips when SS58 balance already meets threshold', async () => {
    const ctx: any = { cfg: { thresholds: { minSubstrateTao: '1.0' }, dryRun: true }, api: {}, account: { ss58: '5xxx' }, log: { info() {} } };
    expect((await faucetSubstrateStep.run(ctx)).status).toBe('skipped');
  });

  it('returns done dry-run when balance low and dryRun', async () => {
    const mod = await import('../src/substrate.ts');
    (mod.substrateBalance as any).mockResolvedValueOnce(0n);
    const ctx: any = { cfg: { thresholds: { minSubstrateTao: '1.0' }, dryRun: true }, api: {}, account: { ss58: '5xxx' }, log: { info() {} } };
    expect((await faucetSubstrateStep.run(ctx)).tx).toBe('dry-run');
  });
});
