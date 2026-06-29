import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/steps/executor.ts', () => ({ execWrite: vi.fn().mockResolvedValue('0xhash') }));
vi.mock('../src/state.ts', () => ({ loadState: vi.fn() }));

import { faucetDevnetStep } from '../src/steps/faucet-devnet.ts';
import { execWrite } from '../src/steps/executor.ts';
import { loadState } from '../src/state.ts';

const baseCtx = (cfg: any) => ({
  cfg: { stepDelayMs: 0, ...cfg },
  account: { id: 'acc1', h160: '0xabc' },
  log: { info() {}, warn() {} },
});

describe('faucetDevnetStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadState as any).mockReturnValue({ id: 'acc1', steps: {} });
  });

  it('skips when no tokens configured', async () => {
    const ctx: any = baseCtx({ faucetDevnet: { amount: '1000', tokens: [] } });
    expect((await faucetDevnetStep.run(ctx)).status).toBe('skipped');
  });

  it('skips when already claimed today', async () => {
    (loadState as any).mockReturnValue({ id: 'acc1', steps: { 'faucet-devnet': { status: 'done', at: new Date().toISOString() } } });
    const ctx: any = baseCtx({ faucetDevnet: { amount: '1000', tokens: [{ symbol: 'A', address: '0x01' }] } });
    expect((await faucetDevnetStep.run(ctx)).status).toBe('skipped');
    expect(execWrite).not.toHaveBeenCalled();
  });

  it('mints each token and returns done', async () => {
    const ctx: any = baseCtx({ faucetDevnet: { amount: '1000', tokens: [{ symbol: 'A', address: '0x01' }, { symbol: 'B', address: '0x02' }] } });
    const res = await faucetDevnetStep.run(ctx);
    expect(res.status).toBe('done');
    expect(execWrite).toHaveBeenCalledTimes(2);
  });

  it('continues past a token that fails simulation; fails only if all fail', async () => {
    (execWrite as any).mockRejectedValue(new Error('execution reverted'));
    const ctx: any = baseCtx({ faucetDevnet: { amount: '1000', tokens: [{ symbol: 'A', address: '0x01' }] } });
    expect((await faucetDevnetStep.run(ctx)).status).toBe('failed');
  });
});
