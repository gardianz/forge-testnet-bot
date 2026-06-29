import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'zod';

const Thresholds = z.object({
  minSubstrateTao: z.string(),
  minEvmGas: z.string(),
  warpAmount: z.string(),
  supplyAmount: z.string(),
  borrowFraction: z.number().positive().max(0.9),
  borrowAmount: z.string().default('0.05'), // fixed borrow size in borrow-token units
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
  // EVM faucet = mint the mock collateral token (verified: WTAO exposes an open
  // mint(address,uint256) on testnet). `token` defaults to WTAO; `amount` is in
  // human units minted to the account's H160.
  evmFaucet: z
    .object({
      token: z.string().optional(),
      amount: z.string().default('5'),
    })
    .optional(),
  // Borrowing needs a collateral asset with CF>0. wsTAO has CF=0, so supply a
  // mock Alpha token (mALPHA30, CF=0.25, openly mintable on testnet) as
  // collateral before borrowing.
  collateral: z
    .object({
      underlying: z.string(),
      vToken: z.string(),
      mintAmount: z.string().default('10'),
      supplyAmount: z.string().default('5'),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(path = 'config.yaml'): Config {
  const raw = yaml.load(readFileSync(path, 'utf8'));
  return ConfigSchema.parse(raw);
}
