import type { PublicClient, WalletClient } from 'viem';
import type { ApiPromise } from '@polkadot/api';
import type { Logger } from 'pino';
import type { Config } from '../config.ts';
import type { Account } from '../accounts.ts';

export type StepStatusResult = 'done' | 'skipped' | 'failed';

export type StepResult = { status: StepStatusResult; tx?: string; error?: string };

export type StepContext = {
  cfg: Config;
  pc: PublicClient;
  wc: WalletClient;
  api: ApiPromise | null;
  account: Account;
  log: Logger;
};

export interface Step {
  name: string;
  run(ctx: StepContext): Promise<StepResult>;
}
