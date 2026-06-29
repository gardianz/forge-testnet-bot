import cron from 'node-cron';
import { loadAccounts, runAll } from './runner.ts';
import { attachProxies, loadProxies } from './proxies.ts';
import { Dashboard } from './dashboard.ts';
import { printSummary, summarize } from './reporter.ts';
import { sendTelegram } from './telegram.ts';
import { quietPolkadot } from './quiet.ts';
import type { Config } from './config.ts';
import type { Step } from './steps/types.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadAll(cfg: Config) {
  const key = process.env.ACCOUNTS_KEY || '';
  const accounts = await loadAccounts(process.env.FORGE_ACCOUNTS || 'accounts.json', key, cfg.ss58Format);
  attachProxies(accounts, loadProxies(process.env.FORGE_PROXIES || cfg.proxyFile));
  return accounts;
}

async function runCycle(cfg: Config, steps: Step[], label: string, dashboardForce?: boolean) {
  const accounts = await loadAll(cfg);
  const dash = new Dashboard(
    { title: `Forge ${label}`, chainId: cfg.chainId, dryRun: cfg.dryRun, steps: steps.map((s) => s.name), accountIds: accounts.map((a) => a.id) },
    dashboardForce,
  );
  dash.start();
  const states = await runAll(cfg, accounts, steps, dash);
  dash.finish();
  if (!dash.enabled) printSummary(states);
  await sendTelegram(`Forge ${label} run (dryRun=${cfg.dryRun}):\n${summarize(states)}`);
}

/**
 * Daemon: stay up 24/7 and run the pipeline once per "day" at a RANDOM gap in
 * [daemon.minHours, daemon.maxHours] (default 22–26h), so the daily run drifts
 * to a different clock time each day. Per-account jitter (cfg.accountJitterMs)
 * further spreads activity. Survives a failed cycle and schedules the next.
 */
export async function runDaemon(cfg: Config, steps: Step[], label: string, dashboardForce?: boolean): Promise<void> {
  quietPolkadot();
  const d = cfg.daemon;
  if (d.startJitterMaxSec > 0) {
    const j = Math.floor(Math.random() * d.startJitterMaxSec);
    console.log(`daemon: first run in ${(j / 60).toFixed(1)} min`);
    await sleep(j * 1000);
  }
  for (;;) {
    try {
      await runCycle(cfg, steps, label, dashboardForce);
    } catch (e) {
      console.error('daemon cycle error:', (e as Error).message);
    }
    const gapH = d.minHours + Math.random() * Math.max(0, d.maxHours - d.minHours);
    const gapMs = Math.floor(gapH * 3_600_000);
    const next = new Date(Date.now() + gapMs);
    console.log(`daemon: next run ~ ${next.toISOString().slice(0, 16).replace('T', ' ')} UTC (in ${gapH.toFixed(1)}h)`);
    await sleep(gapMs);
  }
}

/** Schedule the daily bot run on a fixed `cronExpr` (use runDaemon for random). */
export function scheduleBot(cfg: Config, steps: Step[], cronExpr: string, label: string, dashboardForce?: boolean): void {
  quietPolkadot();
  cron.schedule(cronExpr, () => {
    runCycle(cfg, steps, label, dashboardForce).catch((e) => console.error('cron cycle error:', (e as Error).message));
  });
  console.log(`scheduled ${label}: ${cronExpr}`);
}
