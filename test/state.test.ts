import { describe, it, expect, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import { loadState, saveStep } from '../src/state.ts';

beforeEach(() => { try { rmSync('state/t1.json'); } catch {} });

describe('state', () => {
  it('persists step status', () => {
    saveStep('t1', 'warp', { status: 'done', tx: '0xabc' });
    expect(loadState('t1').steps.warp.status).toBe('done');
    expect(loadState('t1').steps.warp.tx).toBe('0xabc');
  });
  it('returns empty state for unknown account', () => {
    expect(loadState('nope').steps).toEqual({});
  });
});
