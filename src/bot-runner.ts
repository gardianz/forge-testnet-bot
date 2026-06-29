import { loadConfig, type Config } from './config.ts';
import { loadAccounts, runAll } from './runner.ts';
import { printSummary, summarize } from './reporter.ts';
import { scheduleBot } from './scheduler.ts';
import { sendTelegram } from './telegram.ts';
import type { Step } from './steps/types.ts';

/** Shared entrypoint for the faucet bot and the main bot. */
export async function runBot(label: string, steps: Step[], cronKey: 'faucetCron' | 'mainCron'): Promise<void> {
  const argv = process.argv.slice(2);
  const cfg = loadConfig(process.env.FORGE_CONFIG || 'config.yaml');
  if (argv.includes('--no-dry-run')) (cfg as Config).dryRun = false;
  if (argv.includes('--dry-run')) (cfg as Config).dryRun = true;

  const key = process.env.ACCOUNTS_KEY || '';
  const accountsPath = process.env.FORGE_ACCOUNTS || 'accounts.json';

  if (argv.includes('--schedule')) {
    scheduleBot(cfg, accountsPath, key, steps, cfg[cronKey], label);
    return;
  }

  const accounts = await loadAccounts(accountsPath, key, cfg.ss58Format);
  const states = await runAll(cfg, accounts, steps);
  printSummary(states);
  await sendTelegram(`Forge ${label} run (dryRun=${cfg.dryRun}):\n${summarize(states)}`);
}
