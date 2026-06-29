import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'zod';

const Thresholds = z.object({
  minSubstrateTao: z.string(),
  minEvmGas: z.string(),
  warpAmount: z.string(),
  supplyAmount: z.string(),
  borrowFraction: z.number().positive().max(0.9),
});

const ConfigSchema = z.object({
  evmRpc: z.string().url(),
  chainId: z.literal(945),
  substrateRpc: z.string(),
  ss58Format: z.number().int(),
  forgeFaucetUrl: z.string().url(),
  substrateFaucetUrl: z.string().url().default('https://taoswap.org/testnet-faucet'),
  scheduleCron: z.string().default('0 9 * * *'),
  faucetCron: z.string().default('0 8 * * *'),  // faucet bot daily
  mainCron: z.string().default('30 8 * * *'),   // main bot daily, after faucet
  thresholds: Thresholds,
  maxConcurrent: z.number().int().positive().default(3),
  stepDelayMs: z.number().int().nonnegative().default(4000),
  accountDelayMs: z.number().int().nonnegative().default(8000),
  marketToken: z.enum(['wsTAO', 'WTAO']).default('wsTAO'),
  recycle: z.boolean().default(true),
  dryRun: z.boolean().default(true),
  captcha: z.object({ provider: z.enum(['2captcha', 'anticaptcha']) }).partial().optional(),
  // EVM faucet on the Forge site is an on-chain mint (the "Faucet" page calls a
  // contract), NOT an HTTP endpoint. Fill after capturing one live claim tx:
  //   address = faucet contract, method = e.g. "faucet" / "mint" / "drip",
  //   passAddress = true if the method takes the recipient H160 as its arg.
  evmFaucet: z
    .object({
      address: z.string(),
      method: z.string().default('faucet'),
      passAddress: z.boolean().default(false),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(path = 'config.yaml'): Config {
  const raw = yaml.load(readFileSync(path, 'utf8'));
  return ConfigSchema.parse(raw);
}
