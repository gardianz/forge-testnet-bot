import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/main.ts';

describe('parseArgs', () => {
  it('parses flags', () => {
    const a = parseArgs(['--once', '--account', 'acc1', '--no-dry-run']);
    expect(a.once).toBe(true);
    expect(a.account).toBe('acc1');
    expect(a.dryRun).toBe(false);
  });
  it('defaults are undefined/false', () => {
    const a = parseArgs([]);
    expect(a.once).toBe(false);
    expect(a.check).toBe(false);
    expect(a.account).toBeUndefined();
    expect(a.dryRun).toBeUndefined();
  });
  it('parses --check and --step', () => {
    const a = parseArgs(['--check', '--step', 'warp']);
    expect(a.check).toBe(true);
    expect(a.step).toBe('warp');
  });
});
