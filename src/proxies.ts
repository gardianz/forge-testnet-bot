import { existsSync, readFileSync } from 'node:fs';
import type { Account } from './accounts.ts';

/**
 * Normalise one proxy line to a URL viem/undici and Playwright accept.
 * Bare `host:port` or `user:pass@host:port` is assumed to be HTTP.
 * Schemes http/https/socks4/socks5 are passed through unchanged.
 */
export function normalizeProxy(line: string): string {
  const s = line.trim();
  if (!s) return s;
  if (/^(https?|socks[45]?):\/\//i.test(s)) return s;
  return `http://${s}`;
}

/**
 * Load proxies from `path` (default proxy.txt): one proxy per line, blank lines
 * and `#` comments ignored. Order matters — line N maps to account N.
 */
export function loadProxies(path = 'proxy.txt'): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map(normalizeProxy);
}

/**
 * Assign proxies to accounts by index. A proxy.txt entry OVERRIDES any `proxy`
 * already set on the account (from accounts.json). Accounts past the end of the
 * list keep whatever proxy they had (possibly none).
 */
export function attachProxies(accounts: Account[], proxies: string[]): void {
  accounts.forEach((a, i) => {
    if (proxies[i]) a.proxy = proxies[i];
  });
}
