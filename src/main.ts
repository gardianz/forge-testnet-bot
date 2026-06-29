import { formatEther, formatUnits } from 'viem';
import { loadConfig, type Config } from './config.ts';
import { loadAccounts, type Account } from './accounts.ts';
import { connectSubstrate, fillMirrorAddresses } from './substrate.ts';
import { makePublicClient } from './evm.ts';
import { attachProxies, loadProxies } from './proxies.ts';
import { fetchBalances } from './balances.ts';
import { Dashboard } from './dashboard.ts';
import { runAll, runAccount, makeCtx, STEPS, STEP_NAMES } from './runner.ts';
import { printSummary, summarize } from './reporter.ts';
import { scheduleBot, runDaemon } from './scheduler.ts';
import { sendTelegram } from './telegram.ts';
import { loadState } from './state.ts';
import { generateAccounts } from './wallet.ts';
import { quietPolkadot } from './quiet.ts';

export type Args = {
  once: boolean;
  check: boolean;
  schedule: boolean;
  daemon: boolean;
  account?: string;
  step?: string;
  dryRun?: boolean;
  dashboard?: boolean;
  gen?: number;
};

export function parseArgs(argv: string[]): Args {
  const a: Args = { once: false, check: false, schedule: false, daemon: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--once': a.once = true; break;
      case '--check': a.check = true; break;
      case '--schedule': a.schedule = true; break;
      case '--daemon': a.daemon = true; break;
      case '--account': a.account = argv[++i]; break;
      case '--step': a.step = argv[++i]; break;
      case '--dry-run': a.dryRun = true; break;
      case '--no-dry-run': a.dryRun = false; break;
      case '--dashboard': a.dashboard = true; break;
      case '--no-dashboard': a.dashboard = false; break;
      case '--gen': a.gen = Math.max(1, parseInt(argv[++i] || '1', 10) || 1); break;
    }
  }
  return a;
}

/** Resolve accounts.json + proxy.txt into ready-to-run accounts. */
export async function resolveAccounts(cfg: Config, accountFilter?: string): Promise<Account[]> {
  const key = process.env.ACCOUNTS_KEY || '';
  let accounts = await loadAccounts(process.env.FORGE_ACCOUNTS || 'accounts.json', key, cfg.ss58Format);
  attachProxies(accounts, loadProxies(process.env.FORGE_PROXIES || cfg.proxyFile));
  if (accountFilter) accounts = accounts.filter((a) => a.id === accountFilter);
  return accounts;
}

function num(v: bigint, decimals: number, dp: number): string {
  const s = formatUnits(v, decimals);
  const [int, frac = ''] = s.split('.');
  return `${int}.${(frac + '0'.repeat(dp)).slice(0, dp)}`;
}
function proxyHost(p?: string): string {
  if (!p) return 'direct';
  try { const u = new URL(p); return `${u.hostname}:${u.port}`; } catch { return p; }
}
const GLYPH: Record<string, string> = { done: '✓', skipped: '–', failed: '✗', pending: '·' };

async function printCheck(cfg: Config, accounts: Account[]): Promise<void> {
  fillMirrorAddresses(accounts, cfg.ss58Format);
  const api = await connectSubstrate(cfg).catch(() => null);
  const pc = makePublicClient(cfg);
  const cols: [string, number][] = [['ACCOUNT', 8], ['PROXY', 20], ['GAS', 10], ['subTAO', 12], ['wsTAO', 10], ['vTKN', 8], ['BORROW', 10]];
  const code: Record<string, string> = { 'faucet-devnet': 'fdv', 'faucet-substrate': 'fsb', bridge: 'brg', warp: 'wrp', supply: 'sup', collateral: 'col', borrow: 'bor', repay: 'rpy', redeem: 'rdm' };
  const stepHdr = STEP_NAMES.map((n) => code[n] ?? n.slice(0, 3)).join(' ');
  const header = cols.map(([h, w], i) => (i === 0 || i === 1 ? h.padEnd(w) : h.padStart(w))).join('  ') + '  ' + stepHdr;
  console.log(header);
  console.log('─'.repeat(header.length));
  for (const acc of accounts) {
    const b = await fetchBalances(cfg, acc, api, pc);
    const st = loadState(acc.id);
    const strip = STEP_NAMES.map((n) => (GLYPH[st.steps[n]?.status ?? 'pending'] ?? '·').padEnd(3)).join(' ');
    const row = [
      acc.id.padEnd(8),
      proxyHost(acc.proxy).slice(0, 20).padEnd(20),
      num(b.gas, 18, 4).padStart(10),
      num(b.sub, 9, 4).padStart(12),
      num(b.ws, 18, 4).padStart(10),
      num(b.vtoken, 8, 2).padStart(8),
      num(b.borrow, 18, 4).padStart(10),
    ].join('  ');
    console.log(`${row}  ${strip}`);
  }
  console.log(`\nsteps: ${STEP_NAMES.map((n) => `${code[n] ?? n.slice(0, 3)}=${n}`).join('  ')}`);
  console.log('legend: ✓ done · – skipped · ✗ failed · · pending');
  if (api) await api.disconnect();
}

export async function main(): Promise<void> {
  quietPolkadot();
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(process.env.FORGE_CONFIG || 'config.yaml');
  if (args.dryRun !== undefined) (cfg as Config).dryRun = args.dryRun;

  if (args.gen) {
    const path = process.env.FORGE_ACCOUNTS || 'accounts.json';
    const made = await generateAccounts(args.gen, path, cfg.ss58Format);
    console.log(`generated ${made.length} wallet(s) -> ${path} (secrets in file; gitignored — do NOT share)`);
    console.log('fund any of these to bootstrap (taoswap faucet auto-funds the SS58):');
    for (const m of made) {
      console.log(`  ${m.id.padEnd(8)} H160=${m.h160}`);
      console.log(`  ${''.padEnd(8)} SS58=${m.ss58}`);
      console.log(`  ${''.padEnd(8)} mirror=${m.mirrorSs58}`);
    }
    return;
  }

  const accounts = await resolveAccounts(cfg, args.account);
  if (accounts.length === 0) { console.error('no accounts (check --account / accounts.json)'); process.exit(1); }

  if (args.check) { await printCheck(cfg, accounts); return; }

  if (args.daemon) { await runDaemon(cfg, STEPS, 'forge', args.dashboard); return; }

  if (args.schedule) { scheduleBot(cfg, STEPS, cfg.scheduleCron, 'forge', args.dashboard); return; }

  if (args.step) {
    const step = STEPS.find((s) => s.name === args.step);
    if (!step) { console.error(`unknown step: ${args.step} (have: ${STEP_NAMES.join(', ')})`); process.exit(1); }
    fillMirrorAddresses(accounts, cfg.ss58Format);
    const api = await connectSubstrate(cfg).catch(() => null);
    for (const acc of accounts) await runAccount(makeCtx(cfg, acc, api, null), [step], null);
    if (api) await api.disconnect();
    return;
  }

  // Default action: run the full pipeline once with the live dashboard.
  const dash = new Dashboard(
    { title: 'Forge Testnet Bot', chainId: cfg.chainId, dryRun: cfg.dryRun, steps: STEP_NAMES, accountIds: accounts.map((a) => a.id) },
    args.dashboard,
  );
  dash.start();
  const states = await runAll(cfg, accounts, STEPS, dash);
  dash.finish();
  if (!dash.enabled) printSummary(states);
  await sendTelegram(`Forge run done (dryRun=${cfg.dryRun}):\n${summarize(states)}`);
}

// Run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
