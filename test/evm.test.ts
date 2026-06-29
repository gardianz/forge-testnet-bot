import { describe, it, expect, vi } from 'vitest';
import { erc20Balance, defineBittensorTestnet, accountLiquidity } from '../src/evm.ts';

describe('evm helpers', () => {
  it('defines chain 945', () => {
    expect(defineBittensorTestnet('https://test.chain.opentensor.ai').id).toBe(945);
  });
  it('erc20Balance decodes a mocked call', async () => {
    const pc = { readContract: vi.fn().mockResolvedValue(123n) } as any;
    expect(await erc20Balance(pc, '0xtoken' as any, '0xuser' as any)).toBe(123n);
    expect(pc.readContract).toHaveBeenCalledOnce();
  });
  it('accountLiquidity returns the second tuple element', async () => {
    const pc = { readContract: vi.fn().mockResolvedValue([0n, 999n, 0n]) } as any;
    expect(await accountLiquidity(pc, '0xuser' as any)).toBe(999n);
  });
});
