import cron from 'node-cron';
import { runAll, loadAccounts } from './runner.ts';
import { printSummary } from './reporter.ts';
import { sendTelegram } from './telegram.ts';
import { summarize } from './reporter.ts';
import type { Config } from './config.ts';

export function scheduleRuns(cfg: Config, accountsPath: string, key: string): void {
  cron.schedule(cfg.scheduleCron, async () => {
    const accounts = await loadAccounts(accountsPath, key, cfg.ss58Format);
    const states = await runAll(cfg, accounts);
    printSummary(states);
    await sendTelegram(`Forge run done:\n${summarize(states)}`);
  });
  console.log(`scheduled: ${cfg.scheduleCron}`);
}
