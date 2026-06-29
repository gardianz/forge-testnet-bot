import { describe, it, expect } from 'vitest';
import { Dashboard, makeLogger } from '../src/dashboard.ts';

const opts = {
  title: 'Forge Testnet Bot',
  chainId: 945,
  dryRun: true,
  steps: ['faucet-devnet', 'warp', 'borrow'],
  accountIds: ['acc1', 'acc2'],
};

describe('Dashboard.frame', () => {
  it('renders title, accounts, and step grid', () => {
    const d = new Dashboard(opts, false); // force-disabled (no live paint)
    const f = d.frame();
    expect(f).toContain('Forge Testnet Bot');
    expect(f).toContain('chain 945');
    expect(f).toContain('acc1');
    expect(f).toContain('acc2');
    expect(f).toContain('fdv'); // step code for faucet-devnet
  });

  it('reflects step status glyphs and balances', () => {
    const d = new Dashboard(opts, false);
    d.setBalances('acc1', { gas: 10n ** 18n, sub: 5n * 10n ** 9n, ws: 0n, vtoken: 0n, borrow: 0n });
    d.stepEnd('acc1', 'warp', 'done');
    d.stepEnd('acc1', 'borrow', 'failed');
    const f = d.frame();
    expect(f).toContain('✓'); // done
    expect(f).toContain('✗'); // failed
    expect(f).toContain('1.0000'); // gas formatted
  });

  it('keeps a log tail', () => {
    const d = new Dashboard(opts, false);
    d.log('info', 'acc1', 'hello world', { step: 'warp', tx: '0xabcdef0123456789' });
    expect(d.frame()).toContain('hello world');
  });
});

describe('makeLogger', () => {
  it('returns a usable logger without a dashboard', () => {
    const log = makeLogger(null, 'acc1');
    expect(typeof log.info).toBe('function');
  });
});
