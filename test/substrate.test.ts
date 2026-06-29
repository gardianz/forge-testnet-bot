import { describe, it, expect, beforeAll } from 'vitest';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { h160ToMirrorSs58 } from '../src/substrate.ts';

beforeAll(async () => { await cryptoWaitReady(); });

describe('mirror ss58', () => {
  it('is deterministic and ss58Format-42', () => {
    const a = h160ToMirrorSs58('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 42);
    expect(a).toBe(h160ToMirrorSs58('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 42));
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(46);
  });
});
