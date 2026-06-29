/**
 * Silence known third-party console noise so the bot's own output stays clean.
 * @polkadot/api logs "REGISTRY: Unknown signed extensions …" and "API/INIT: RPC
 * methods not decorated …" on every connect to Subtensor (a custom chain with
 * non-standard extensions/RPCs) — informational, not errors. We also drop the
 * "@polkadot/* has multiple versions" dedupe warnings as a belt-and-suspenders.
 */
const NOISE = [
  'RPC methods not decorated',
  'Unknown signed extensions',
  'API/INIT:',
  'REGISTRY:',
  'has multiple versions',
  'conflicting packages',
  'dedupe using your package manager',
];

let patched = false;

export function quietPolkadot(): void {
  if (patched) return;
  patched = true;
  for (const m of ['log', 'warn', 'error'] as const) {
    const orig = console[m].bind(console);
    console[m] = (...args: unknown[]) => {
      const s = args.map((a) => String(a)).join(' ');
      if (NOISE.some((n) => s.includes(n))) return;
      orig(...args);
    };
  }
}
