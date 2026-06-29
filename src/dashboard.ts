import { appendFileSync, mkdirSync } from 'node:fs';
import pino, { type Logger } from 'pino';
import { formatUnits } from 'viem';
import type { Balances } from './balances.ts';
import { ZERO_BALANCES } from './balances.ts';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
};

type RowStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

const GLYPH: Record<RowStatus, { ch: string; color: string }> = {
  pending: { ch: '·', color: C.dim },
  running: { ch: '►', color: C.yellow },
  done: { ch: '✓', color: C.green },
  skipped: { ch: '–', color: C.gray },
  failed: { ch: '✗', color: C.red },
};

/** Short 3-char code per known step (for the compact step grid). */
const STEP_CODE: Record<string, string> = {
  'faucet-devnet': 'fdv',
  'faucet-substrate': 'fsb',
  bridge: 'brg',
  warp: 'wrp',
  supply: 'sup',
  collateral: 'col',
  borrow: 'bor',
  repay: 'rpy',
  redeem: 'rdm',
};

type LogLine = { t: string; level: string; account: string; step?: string; msg: string; tx?: string };

type Row = {
  id: string;
  proxy: string;
  bal: Balances;
  current: string;
  steps: Record<string, RowStatus>;
};

function pad(s: string, w: number): string {
  const t = s.length > w ? s.slice(0, w - 1) + '…' : s;
  return t.padEnd(w);
}
function padL(s: string, w: number): string {
  const t = s.length > w ? s.slice(0, w) : s;
  return t.padStart(w);
}
/** Format a fixed-point bigint to `dp` decimals (trailing trimmed-ish, fixed width). */
function fmt(v: bigint, decimals: number, dp: number): string {
  const s = formatUnits(v, decimals);
  const [int, frac = ''] = s.split('.');
  return `${int}.${(frac + '0'.repeat(dp)).slice(0, dp)}`;
}
function proxyHost(p: string): string {
  if (!p) return '';
  try {
    const u = new URL(p);
    return `${u.protocol.replace(':', '')}:${u.hostname}:${u.port}`.replace(/^http:/, '');
  } catch {
    return p;
  }
}

export type DashboardOpts = {
  title: string;
  chainId: number;
  dryRun: boolean;
  steps: string[];
  accountIds: string[];
};

/**
 * Live terminal dashboard: a per-account balance table, a compact step-status
 * grid, and a tail of recent log lines. Repaints in place on a TTY; on a non-TTY
 * (cron, redirected output) it disables the live paint and the bot falls back to
 * line logging. Logs are always tee'd to logs/run-<date>.log.
 */
export class Dashboard {
  readonly enabled: boolean;
  private readonly opts: DashboardOpts;
  private readonly rows = new Map<string, Row>();
  private readonly logs: LogLine[] = [];
  private readonly started = Date.now();
  private readonly logFile: string;

  constructor(opts: DashboardOpts, force?: boolean) {
    this.opts = opts;
    this.enabled = force ?? Boolean(process.stdout.isTTY);
    for (const id of opts.accountIds) {
      const steps: Record<string, RowStatus> = {};
      for (const s of opts.steps) steps[s] = 'pending';
      this.rows.set(id, { id, proxy: '', bal: { ...ZERO_BALANCES }, current: '', steps });
    }
    mkdirSync('logs', { recursive: true });
    this.logFile = `logs/run-${new Date().toISOString().slice(0, 10)}.log`;
  }

  setProxy(id: string, proxy: string): void {
    const r = this.rows.get(id);
    if (r) r.proxy = proxy;
  }
  setBalances(id: string, b: Balances): void {
    const r = this.rows.get(id);
    if (r) r.bal = b;
    this.render();
  }
  stepStart(id: string, step: string): void {
    const r = this.rows.get(id);
    if (r) {
      r.current = step;
      r.steps[step] = 'running';
    }
    this.render();
  }
  stepEnd(id: string, step: string, status: RowStatus): void {
    const r = this.rows.get(id);
    if (r) r.steps[step] = status;
    this.render();
  }

  log(level: string, account: string, msg: string, extra?: { step?: string; tx?: string }): void {
    const line: LogLine = {
      t: new Date().toISOString().slice(11, 19),
      level,
      account,
      step: extra?.step,
      msg,
      tx: extra?.tx,
    };
    this.logs.push(line);
    try {
      appendFileSync(this.logFile, `${line.t} ${level.toUpperCase()} ${account} ${line.step ?? ''} ${msg}${line.tx ? ' ' + line.tx : ''}\n`);
    } catch {
      /* ignore log-file errors */
    }
    if (this.enabled) this.render();
    else console.log(`${C.gray}${line.t}${C.reset} ${account} ${line.step ? C.cyan + line.step + C.reset + ' ' : ''}${this.colorMsg(level, msg)}${line.tx ? ' ' + C.blue + short(line.tx) + C.reset : ''}`);
  }

  private colorMsg(level: string, msg: string): string {
    const c = level === 'error' ? C.red : level === 'warn' ? C.yellow : C.white;
    return `${c}${msg}${C.reset}`;
  }

  start(): void {
    if (this.enabled) process.stdout.write('\x1b[2J\x1b[H');
    this.render();
  }
  finish(): void {
    this.render();
  }

  /** Build the full frame as a string (also used by tests). */
  frame(): string {
    const { title, chainId, dryRun } = this.opts;
    const elapsed = Math.floor((Date.now() - this.started) / 1000);
    const dr = dryRun ? `${C.yellow}DRY-RUN${C.reset}` : `${C.green}LIVE${C.reset}`;
    const out: string[] = [];
    out.push(`${C.bold}${C.magenta}▌ ${title}${C.reset}  ${C.gray}chain ${chainId} · ${dr} · ${this.rows.size} acct · ${elapsed}s · ${new Date().toISOString().slice(0, 19).replace('T', ' ')}${C.reset}`);
    out.push('');

    // Balance table
    const head =
      pad('ACCOUNT', 9) + pad('PROXY', 22) + padL('GAS', 11) + padL('subTAO', 13) + padL('wsTAO', 11) + padL('vTKN', 11) + padL('BORROW', 11) + '  ' + pad('STEP', 16) + 'STATUS';
    out.push(`${C.bold}${C.gray}${head}${C.reset}`);
    for (const r of this.rows.values()) {
      const st = r.current ? r.steps[r.current] ?? 'pending' : 'pending';
      const g = GLYPH[st];
      out.push(
        `${C.cyan}${pad(r.id, 9)}${C.reset}` +
          `${C.gray}${pad(proxyHost(r.proxy) || 'direct', 22)}${C.reset}` +
          padL(fmt(r.bal.gas, 18, 4), 11) +
          padL(fmt(r.bal.sub, 9, 4), 13) +
          padL(fmt(r.bal.ws, 18, 4), 11) +
          padL(fmt(r.bal.vtoken, 8, 2), 11) +
          padL(fmt(r.bal.borrow, 18, 4), 11) +
          '  ' +
          pad(r.current || '-', 16) +
          `${g.color}${g.ch} ${st}${C.reset}`,
      );
    }
    out.push('');

    // Step grid
    const codes = this.opts.steps.map((s) => STEP_CODE[s] ?? s.slice(0, 3));
    out.push(`${C.gray}${pad('STEPS', 9)}${codes.map((c) => padL(c, 4)).join('')}${C.reset}`);
    for (const r of this.rows.values()) {
      const cells = this.opts.steps
        .map((s) => {
          const g = GLYPH[r.steps[s] ?? 'pending'];
          return `${g.color}${padL(g.ch, 4)}${C.reset}`;
        })
        .join('');
      out.push(`${C.cyan}${pad(r.id, 9)}${C.reset}${cells}`);
    }
    out.push('');

    // Log tail
    const rows = process.stdout.rows || 40;
    const used = out.length + 3;
    const n = Math.max(6, rows - used - 1);
    out.push(`${C.bold}${C.gray}── log ─────────────────────────────────────────────${C.reset}`);
    for (const l of this.logs.slice(-n)) {
      out.push(
        `${C.gray}${l.t}${C.reset} ${C.cyan}${pad(l.account, 6)}${C.reset}${l.step ? C.magenta + pad(l.step, 16) + C.reset : pad('', 16)}${this.colorMsg(l.level, l.msg)}${l.tx ? ' ' + C.blue + short(l.tx) + C.reset : ''}`,
      );
    }
    return out.join('\n');
  }

  private render(): void {
    if (!this.enabled) return;
    // Append \x1b[K (erase to end of line) to every line so a shorter new line
    // doesn't leave stale tail characters from the previous frame; the trailing
    // \x1b[J clears any extra rows below when the frame shrinks.
    const body = this.frame()
      .split('\n')
      .map((l) => l + '\x1b[K')
      .join('\n');
    process.stdout.write('\x1b[H' + body + '\x1b[J');
  }
}

function short(tx: string): string {
  return tx.length > 14 ? `${tx.slice(0, 8)}…${tx.slice(-4)}` : tx;
}

const LEVEL: Record<number, string> = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };

/**
 * Per-account logger. With a live dashboard it feeds the dashboard's log buffer
 * (and the log file); without one it pretty-prints to stdout (cron-friendly).
 */
export function makeLogger(dash: Dashboard | null, accountId: string): Logger {
  if (dash && dash.enabled) {
    const stream = {
      write(s: string): void {
        for (const raw of s.split('\n')) {
          if (!raw.trim()) continue;
          try {
            const o = JSON.parse(raw);
            dash.log(LEVEL[o.level] ?? 'info', accountId, o.msg ?? '', { step: o.step, tx: o.tx });
          } catch {
            dash.log('info', accountId, raw.trim());
          }
        }
      },
    };
    return pino({ level: 'debug', base: undefined }, stream as never);
  }
  return pino({ transport: { target: 'pino-pretty' } }).child({ account: accountId });
}
