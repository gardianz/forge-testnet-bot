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
  // taoswap substrate faucet trigger: claim only when the SS58 free balance drops
  // below this (a fresh/empty wallet → claim; after a ~1 TAO claim → skip).
  minSubstrateClaim: z.string().default('0.5'),
  // Left on the SS58 when bridging (covers existential deposit + tx fee); also the
  // headroom the bridge keeps so transferKeepAlive can't hit FundsUnavailable.
  substrateFeeBuffer: z.string().default('0.01'),
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
  // Extra random 0..accountJitterMs delay before each account, and a shuffled
  // account order — spreads activity so accounts don't act in lockstep.
  accountJitterMs: z.number().int().nonnegative().default(0),
  // Daemon mode (`--daemon`): stay up 24/7 and run once per "day" at a random
  // gap in [minHours, maxHours]. startJitterMaxSec randomises the first run.
  daemon: z
    .object({
      minHours: z.number().positive().default(22),
      maxHours: z.number().positive().default(26),
      startJitterMaxSec: z.number().int().nonnegative().default(0),
    })
    .default({ minHours: 22, maxHours: 26, startJitterMaxSec: 0 }),
  marketToken: z.enum(['wsTAO', 'WTAO']).default('wsTAO'),
  recycle: z.boolean().default(true),
  dryRun: z.boolean().default(true),
  captcha: z.object({ provider: z.enum(['2captcha', 'anticaptcha']) }).partial().optional(),
  // taoswap substrate faucet — direct API (no browser). Verified live: the SPA
  // POSTs {ss58_address, amount, captcha_token} to this URL; captcha_token is a
  // Cloudflare Turnstile token (sitekey below) solved via the captcha provider.
  substrateFaucet: z
    .object({
      apiUrl: z.string().default('https://api.taoswap.org/testnet-faucet/'),
      sitekey: z.string().default('0x4AAAAAADsYqTeKzaXU5Qhb'),
      amount: z.string().default('1'),
    })
    .default({ apiUrl: 'https://api.taoswap.org/testnet-faucet/', sitekey: '0x4AAAAAADsYqTeKzaXU5Qhb', amount: '1' }),
  // Path to the proxy list (one proxy per line, mapped to accounts by index).
  // proxy.txt entries OVERRIDE any `proxy` set in accounts.json.
  proxyFile: z.string().default('proxy.txt'),
  // Forge devnet faucet (https://testnet.forge.endure.network/#/devnet-faucet).
  // Claimed daily: mints each listed token via its open `mint(address,uint256)`.
  // `amount` is the per-token default (human units); a token may override it.
  // Tokens whose mint isn't open simulate-fail and are skipped (no gas spent).
  faucetDevnet: z
    .object({
      amount: z.string().default('1000'),
      tokens: z
        .array(
          z.object({
            symbol: z.string(),
            address: z.string(),
            amount: z.string().optional(),
            decimals: z.number().int().optional(),
          }),
        )
        .default([]),
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
