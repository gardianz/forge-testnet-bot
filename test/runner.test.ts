import { describe, it, expect } from 'vitest';
import { runAccount } from '../src/runner.ts';

describe('runAccount', () => {
  it('runs steps in order and stops on failure', async () => {
    const calls: string[] = [];
    const mk = (name: string, status: string) => ({ name, run: async () => { calls.push(name); return { status }; } });
    const steps: any = [mk('a', 'done'), mk('b', 'failed'), mk('c', 'done')];
    const ctx: any = { cfg: { dryRun: true, stepDelayMs: 0 }, pc: {}, wc: {}, api: {}, account: { id: 't' }, log: { info() {}, error() {} } };
    const state = await runAccount(ctx, steps);
    expect(calls).toEqual(['a', 'b']); // c not reached
    expect(state.steps.b.status).toBe('failed');
  });

  it('runs all steps when none fail', async () => {
    const calls: string[] = [];
    const mk = (name: string) => ({ name, run: async () => { calls.push(name); return { status: 'done' }; } });
    const steps: any = [mk('a'), mk('b'), mk('c')];
    const ctx: any = { cfg: { dryRun: true, stepDelayMs: 0 }, pc: {}, wc: {}, api: {}, account: { id: 't2' }, log: { info() {}, error() {} } };
    await runAccount(ctx, steps);
    expect(calls).toEqual(['a', 'b', 'c']);
  });
});
