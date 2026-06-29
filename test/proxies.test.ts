import { describe, it, expect } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProxy, loadProxies, attachProxies } from '../src/proxies.ts';

describe('normalizeProxy', () => {
  it('prefixes http:// for bare host:port', () => {
    expect(normalizeProxy('1.2.3.4:8080')).toBe('http://1.2.3.4:8080');
    expect(normalizeProxy('user:pass@1.2.3.4:8080')).toBe('http://user:pass@1.2.3.4:8080');
  });
  it('passes through known schemes', () => {
    expect(normalizeProxy('http://h:1')).toBe('http://h:1');
    expect(normalizeProxy('socks5://u:p@h:1')).toBe('socks5://u:p@h:1');
  });
});

describe('loadProxies', () => {
  it('reads lines, skips comments/blanks, normalises', () => {
    const p = join(tmpdir(), `proxy-${Date.now()}.txt`);
    writeFileSync(p, '# comment\n\n1.2.3.4:8080\nsocks5://h:1080\n');
    try {
      expect(loadProxies(p)).toEqual(['http://1.2.3.4:8080', 'socks5://h:1080']);
    } finally {
      rmSync(p);
    }
  });
  it('returns [] when file missing', () => {
    expect(loadProxies(join(tmpdir(), 'nope-does-not-exist.txt'))).toEqual([]);
  });
});

describe('attachProxies', () => {
  it('maps by index and overrides existing proxy', () => {
    const accounts: any = [{ id: 'a', proxy: 'old' }, { id: 'b' }, { id: 'c' }];
    attachProxies(accounts, ['http://x:1', 'http://y:2']);
    expect(accounts[0].proxy).toBe('http://x:1'); // overridden
    expect(accounts[1].proxy).toBe('http://y:2');
    expect(accounts[2].proxy).toBeUndefined(); // no proxy line -> untouched
  });
});
