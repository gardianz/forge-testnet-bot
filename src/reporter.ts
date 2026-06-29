import type { AccountState } from './state.ts';

export function summarize(states: AccountState[]): string {
  const lines: string[] = [];
  for (const s of states) {
    const cells = Object.entries(s.steps).map(([k, v]) => `${k}:${v.status}`);
    lines.push(`${s.id.padEnd(10)} ${cells.join('  ')}`);
  }
  return lines.join('\n');
}

export function printSummary(states: AccountState[]): void {
  console.log('\n=== run summary ===');
  console.log(summarize(states));
}
