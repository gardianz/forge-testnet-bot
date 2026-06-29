import { describe, it, expect } from 'vitest';
import { ADDRESSES, assertChainId } from '../src/contracts.ts';

describe('contracts', () => {
  it('has the core Forge addresses', () => {
    expect(ADDRESSES.comptroller).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(ADDRESSES.wsTAO).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it('guards chainId', () => {
    expect(() => assertChainId(945)).not.toThrow();
    expect(() => assertChainId(964)).toThrow(/945/);
  });
});
