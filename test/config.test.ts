import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  it('parses example config with defaults', () => {
    const cfg = loadConfig('config.example.yaml');
    expect(cfg.chainId).toBe(945);
    expect(cfg.dryRun).toBe(true);
    expect(cfg.thresholds.borrowFraction).toBeGreaterThan(0);
  });
  it('rejects a wrong chainId', () => {
    expect(() => loadConfig('test/fixtures/badchain.yaml')).toThrow();
  });
});
