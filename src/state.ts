import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

export type StepStatus = 'pending' | 'done' | 'skipped' | 'failed';
export type StepRecord = { status: StepStatus; tx?: string; at?: string; error?: string };
export type AccountState = { id: string; steps: Record<string, StepRecord> };

const dir = 'state';
const file = (id: string) => `${dir}/${id}.json`;

export function loadState(id: string): AccountState {
  if (!existsSync(file(id))) return { id, steps: {} };
  return JSON.parse(readFileSync(file(id), 'utf8')) as AccountState;
}

export function saveStep(id: string, step: string, patch: Partial<StepRecord>): void {
  mkdirSync(dir, { recursive: true });
  const s = loadState(id);
  s.steps[step] = { status: 'pending', ...s.steps[step], ...patch, at: new Date().toISOString() };
  writeFileSync(file(id), JSON.stringify(s, null, 2));
}
