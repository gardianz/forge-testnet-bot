import { describe, it, expect, vi } from 'vitest';
import { execWrite } from '../src/steps/executor.ts';

describe('execWrite', () => {
  it('returns dry-run without sending when cfg.dryRun', async () => {
    const ctx: any = {
      cfg: { dryRun: true },
      pc: { getChainId: vi.fn().mockResolvedValue(945), simulateContract: vi.fn().mockResolvedValue({ request: {} }) },
      wc: { account: {}, writeContract: vi.fn() },
    };
    const tx = await execWrite(ctx, { address: '0x0', abi: [], functionName: 'mint', args: [] });
    expect(tx).toBe('dry-run');
    expect(ctx.wc.writeContract).not.toHaveBeenCalled();
  });

  it('refuses a wrong chainId', async () => {
    const ctx: any = {
      cfg: { dryRun: true },
      pc: { getChainId: vi.fn().mockResolvedValue(1), simulateContract: vi.fn() },
      wc: { account: {}, writeContract: vi.fn() },
    };
    await expect(execWrite(ctx, { address: '0x0', abi: [], functionName: 'mint', args: [] })).rejects.toThrow(/945/);
  });

  it('sends and waits when not dry-run', async () => {
    const ctx: any = {
      cfg: { dryRun: false },
      pc: {
        getChainId: vi.fn().mockResolvedValue(945),
        simulateContract: vi.fn().mockResolvedValue({ request: { foo: 1 } }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
      },
      wc: { account: {}, writeContract: vi.fn().mockResolvedValue('0xhash') },
    };
    const tx = await execWrite(ctx, { address: '0x0', abi: [], functionName: 'mint', args: [] });
    expect(tx).toBe('0xhash');
    expect(ctx.pc.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xhash' });
  });
});
