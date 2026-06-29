import pino from 'pino';
import { formatEther } from 'viem';
import { loadConfig, type Config } from './config.ts';
import { loadAccounts, type Account } from './accounts.ts';
import { connectSubstrate, fillMirrorAddresses, substrateBalance } from './substrate.ts';
import { makePublicClient, makeWalletClient, nativeBalance, erc20Balance, borrowBalance } from './evm.ts';
import { ADDRESSES } from './contracts.ts';
import { marketFor } from './steps/supply.ts';
import { runAll, runAccount, STEPS } from './runner.ts';
import { printSummary, summarize } from './reporter.ts';
import { scheduleRuns } from './scheduler.ts';
import { sendTelegram } from './telegram.ts';
import { loadState } from './state.ts';
import type { StepContext } from './steps/types.ts';

export type Args = {
  once: boolean;
  check: boolean;
  schedule: boolean;
  account?: string;
  step?: string;
  dryRun?: boolean;
};

export function parseArgs(argv: string[]): Args {
  const a: Args = { once: false, check: false, schedule: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--once': a.once = true; break;
      case '--check': a.check = true; break;
      case '--schedule': a.schedule = true; break;
      case '--account': a.account = argv[++i]; break;
      case '--step': a.step = argv[++i]; break;
      case '--dry-run': a.dryRun = true; break;
      case '--no-dry-run': a.dryRun = false; break;
    }
  }
  return a;
}

function makeCtx(cfg: Config, account: Account, api: any): StepContext {
  return {
    cfg,
    pc: makePublicClient(cfg, account.proxy),
    wc: makeWalletClient(cfg, account),
    api,
    account,
    log: pino({ transport: { target: 'pino-pretty' } }).child({ account: account.id }),
  };
}

async function printCheck(cfg: Config, accounts: Account[]): Promise<void> {
  fillMirrorAddresses(accounts, cfg.ss58Format);
  const api = await connectSubstrate(cfg).catch(() => null);
  const pc = makePublicClient(cfg);
  const { vToken } = marketFor(cfg);
  for (const acc of accounts) {
    const [gas, sub, ws, vb, owed] = await Promise.all([
      nativeBalance(pc, acc.h160),
      api ? substrateBalance(api, acc.ss58) : Promise.resolve(0n),
      erc20Balance(pc, ADDRESSES.wsTAO, acc.h160),
      erc20Balance(pc, vToken, acc.h160),
      borrowBalance(pc, vToken, acc.h160),
    ]).catch(() => [0n, 0n, 0n, 0n, 0n]);
    const st = loadState(acc.id);
    console.log(
      `${acc.id.padEnd(8)} gas=${formatEther(gas)} subTAO(rao)=${sub} wsTAO=${formatEther(ws)} ` +
      `vToken=${vb} borrow=${owed}  steps=${Object.entries(st.steps).map(([k, v]) => `${k}:${v.status}`).join(',') || '-'}`,
    );
  }
  if (api) await api.disconnect();
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(process.env.FORGE_CONFIG || 'config.yaml');
  if (args.dryRun !== undefined) (cfg as any).dryRun = args.dryRun;

  const key = process.env.ACCOUNTS_KEY || '';
  let accounts = await loadAccounts(process.env.FORGE_ACCOUNTS || 'accounts.json', key, cfg.ss58Format);
  if (args.account) accounts = accounts.filter((a) => a.id === args.account);
  if (accounts.length === 0) { console.error('no accounts (check --account / accounts.json)'); process.exit(1); }

  if (args.check) { await printCheck(cfg, accounts); return; }

  if (args.schedule) { scheduleRuns(cfg, process.env.FORGE_ACCOUNTS || 'accounts.json', key); return; }

  if (args.step) {
    const step = STEPS.find((s) => s.name === args.step);
    if (!step) { console.error(`unknown step: ${args.step}`); process.exit(1); }
    fillMirrorAddresses(accounts, cfg.ss58Format);
    const api = await connectSubstrate(cfg).catch(() => null);
    for (const acc of accounts) await runAccount(makeCtx(cfg, acc, api), [step]);
    if (api) await api.disconnect();
    return;
  }

  if (args.once) {
    const states = await runAll(cfg, accounts);
    printSummary(states);
    await sendTelegram(`Forge run done (dryRun=${cfg.dryRun}):\n${summarize(states)}`);
    return;
  }

  console.log('usage: tsx src/main.ts [--once|--check|--schedule] [--account <id>] [--step <name>] [--dry-run|--no-dry-run]');
}

// Run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
