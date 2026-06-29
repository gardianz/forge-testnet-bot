import { describe, it, expect, beforeAll } from 'vitest';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { deriveH160, deriveSs58 } from '../src/accounts.ts';
import { encryptJson, decryptJson } from '../src/crypto.ts';

const M = 'test test test test test test test test test test test junk';

beforeAll(async () => { await cryptoWaitReady(); });

describe('derivation', () => {
  it('derives the canonical MetaMask H160 for the test mnemonic', () => {
    expect(deriveH160(M).toLowerCase())
      .toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  });
  it('derives a stable sr25519 SS58 (format 42)', () => {
    const a = deriveSs58(M, 42);
    expect(a).toBe(deriveSs58(M, 42));
    expect(a.length).toBeGreaterThan(46);
  });
});

describe('crypto', () => {
  it('round-trips encrypted json', () => {
    const c = encryptJson({ a: 1 }, 'pw');
    expect(decryptJson(c, 'pw')).toEqual({ a: 1 });
  });
});
