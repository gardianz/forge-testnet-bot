import cron from 'node-cron';
import { runAll, loadAccounts } from './runner.ts';
import { printSummary, summarize } from './reporter.ts';
import { sendTelegram } from './telegram.ts';
import type { Config } from './config.ts';
import type { Step } from './steps/types.ts';

/** Schedule one bot (a named step pipeline) on its cron expression. */
export function scheduleBot(
  cfg: Config,
  accountsPath: string,
  key: string,
  steps: Step[],
  cronExpr: string,
  label: string,
): void {
  cron.schedule(cronExpr, async () => {
    const accounts = await loadAccounts(accountsPath, key, cfg.ss58Format);
    const states = await runAll(cfg, accounts, steps);
    printSummary(states);
    await sendTelegram(`Forge ${label} run (dryRun=${cfg.dryRun}):\n${summarize(states)}`);
  });
  console.log(`scheduled ${label}: ${cronExpr}`);
}
