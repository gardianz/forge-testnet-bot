# Forge Testnet Bot — Design

Date: 2026-06-29

## Goal

Automate the Forge Lending testnet checklist across multiple accounts, end to end:

1. Claim Bittensor **substrate** testnet TAO faucet (taoswap).
2. Bridge TAO from Bittensor substrate (SS58) to Bittensor EVM (H160).
3. Claim the **EVM** Bittensor faucet on the Forge site (gas + collateral tokens).
4. Warp (wrap) TAO → wsTAO.
5. Supply wsTAO to the Market, enter market, borrow against it.
6. Repay the borrow and redeem the collateral (recycle funds for repeat runs).

Reward type is "Potential" (no token confirmed) — so the bot optimizes for **completing the on-chain footprint reliably and idempotently**, not for volume.

## Recon findings (ground truth)

Forge is a **Venus Protocol fork** (Compound v2 lineage: `unitroller`/comptroller, `vTokens`, `comptrollerLens`, IRM contracts, `resilientOracle`, diamond facets) deployed on Bittensor's EVM testnet.

| Thing | Value |
|---|---|
| EVM RPC (HTTP) | `https://test.chain.opentensor.ai` |
| EVM chainId | `945` |
| EVM explorer | `https://evm-testscan.dev.opentensor.ai` |
| Substrate RPC (WSS) | `wss://test.finney.opentensor.ai:443` |
| ss58Format | `42` |

Contract addresses (one deploy set found in the app bundle — **must be re-verified at impl**, see Risks):

| Name | Address |
|---|---|
| WTAO (ERC20) | `0xBfd66D9636253f11aE43f3428e8df73b5aD6950f` |
| wsTAO | `0xcff46eb93307ca7E24A7cE2A1Eb0F485A27D461a` |
| vWTAO (supply market) | `0xA0973567D4C0F9b04CbE2c0e95CeDb4465F4e4d1` |
| vWsTAO (supply market) | `0x782E5a6Dc16901ec13D4D1e450A8270F4e6E75cf` |
| Comptroller (unitroller) | `0x10C6E9530F1C1AF873a391030a1D9E8ed0630D26` |

Notes:
- The bundle contains **two deploy sets** (V1 and a newer set) keyed by environment. The live chain-945 set must be pinned by reading the running app config / a live call against the unitroller before trusting any address.
- The Forge app exposes an in-app `devnetFaucet` route (EVM gas + collateral tokens such as `wAlphaStashFaucet`). This is the step-3 EVM faucet — callable directly over HTTP, not necessarily browser-bound.
- "Warp" in the UI = wrap/`deposit`. wsTAO is a wrapped-staked-TAO ERC20.
- Substrate→EVM bridge = transfer native TAO to the **mirror SS58** of the target H160 (Subtensor address-mapping); balance then appears as native gas on the EVM side.

## Decisions (locked with user)

- **Interaction model:** hybrid — Playwright **only** for the captcha-gated substrate faucet; everything else on-chain / direct API.
- **Accounts:** multi-account, concurrent, per-account proxy.
- **Substrate faucet:** Playwright + captcha solver service (user supplies solver API key).
- **Keys:** user provides BIP39 mnemonics in `accounts.json`; bot derives **both** H160 (secp256k1, `m/44'/60'/0'/0/0`) and SS58 (sr25519, ss58Format 42) from each mnemonic.
- **EVM lib:** `viem`.
- **Position handling:** supply → borrow → **repay → redeem** (recycle), so repeated runs are clean.

## Stack

Mirrors the user's `kairo` bot conventions:

- TypeScript, ESM, `tsx` runtime, `vitest` tests.
- `zod` (config/account validation), `pino` + `pino-pretty` (logging), `node-cron` (schedule), `undici` (HTTP), `socks-proxy-agent` (per-account proxy), `crypto-js` (encrypt `accounts.json`).
- Add: `viem` (EVM), `@polkadot/api` + `@polkadot/keyring` + `@polkadot/util-crypto` (substrate), `playwright` (substrate faucet only).

## Architecture

### Account model

`accounts.json` (gitignored, crypto-js encrypted at rest). Each account record:

```jsonc
{
  "id": "acc1",
  "mnemonic": "<bip39 12/24 words>",   // encrypted at rest
  "proxy": "http://user:pass@host:port" // optional, overrides global
}
```

Derivation (`src/accounts.ts`):
- EVM: `mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" })` (viem) → H160.
- Substrate: `Keyring({ type: 'sr25519', ss58Format: 42 }).addFromMnemonic(mnemonic)` → SS58.
- Mirror SS58 of the H160 (for the bridge target) derived via Subtensor's H160→SS58 mapping helper in `src/substrate.ts`.

### Step modules (`src/steps/`)

Each step is a pure-ish function `(ctx, account) => StepResult` that **first runs a skip-check** (reads on-chain / state) and returns `skipped` if the goal is already met. This makes every step idempotent and the whole run resumable.

| # | Module | Action | Skip-check |
|---|---|---|---|
| 1 | `faucet-substrate.ts` | Playwright opens taoswap testnet faucet, fills SS58, solves captcha via solver API, submits | SS58 free balance ≥ `minSubstrateTao` |
| 2 | `bridge.ts` | polkadot.js signed transfer of TAO from SS58 to the H160 mirror-SS58 | EVM native balance ≥ `minEvmGas` |
| 3 | `faucet-evm.ts` | `undici` call to Forge `devnetFaucet` route for H160 (gas + collateral) | EVM native ≥ `minEvmGas` AND collateral token bal > 0 |
| 4 | `warp.ts` | viem write: wrap WTAO/native → wsTAO (`deposit`) | wsTAO balance ≥ `warpAmount` |
| 5 | `supply.ts` | `approve(vToken, amount)` → `vToken.mint(amount)` → `comptroller.enterMarkets([vToken])` | vToken balance > 0 AND market entered |
| 6 | `borrow.ts` | `vToken.borrow(borrowAmount)` (fraction of available liquidity) | borrowBalanceStored > 0 |
| 7 | `repay.ts` | `approve` → `vToken.repayBorrow(max)` | borrowBalanceStored == 0 |
| 8 | `redeem.ts` | `vToken.redeem(vTokenBalance)` → unwrap if configured | vToken balance == 0 |

ABIs live in `abis/` (`erc20`, `vtoken`, `comptroller`, `wstao`), loaded by `src/contracts.ts` which also holds the pinned address map + the chainId-945 guard.

### Orchestration

- `src/runner.ts` — processes accounts concurrently up to `maxConcurrent`, each via its own proxy. For each account, runs steps 1→8 in order; a step that throws is logged and aborts only that account's run (others continue). Skip-checks make re-runs safe.
- `src/state.ts` — per-account JSON in `state/` recording each step's status (`done`/`skipped`/`failed`), last tx hash, timestamp. Source of truth for `--check`.
- `src/reporter.ts` + `src/telegram.ts` — run summary; telegram optional.
- `src/scheduler.ts` — `node-cron` wrapper for daily runs.

### CLI (`src/main.ts`)

- `--once` — run all accounts once and exit.
- `--check` — read-only status table (balances + step state), no transactions.
- `--account <id>` — restrict to one account.
- `--step <name>` — run a single step (debug).
- `--dry-run` — simulate writes (viem `simulateContract` / no broadcast), log intended txs.
- `--schedule` — start cron loop.

### Config & secrets

- `config.yaml` (gitignored) — RPC URLs, chainId, thresholds (`minSubstrateTao`, `minEvmGas`, `warpAmount`, `supplyAmount`, `borrowFraction`), `maxConcurrent`, delays, market token choice (wsTAO vs WTAO), repay/redeem toggle, captcha solver provider.
- `.env` — secrets: `ACCOUNTS_KEY` (crypto-js passphrase), `CAPTCHA_API_KEY`, `TELEGRAM_*`.
- `config.example.yaml`, `accounts.example.json`, `.env.example` committed.

## Safety

- **Chain guard:** `src/contracts.ts` asserts `chainId === 945`; refuses to send if RPC reports mainnet (964) or anything else.
- **Dry-run** default-on for first runs; writes require explicit `--no-dry-run` or `dryRun: false`.
- Testnet-only funds; amounts capped by config; no private keys logged; `accounts.json` encrypted.
- Per-account proxy isolation; concurrency cap to avoid RPC bans.

## Testing

- Unit (`vitest`): key derivation (known mnemonic → known H160 + SS58), skip-check logic (mocked balances), config/account zod schemas, address-set pinning.
- Integration (opt-in, gated by env): single-account dry-run against live testnet RPC for read paths (balances, borrowBalanceStored, comptroller membership).
- Step writes developed TDD: write skip-check test → write step → verify on testnet with one funded account before enabling multi-account.

## Risks / open items (resolve during implementation)

1. **Address set ambiguity** — bundle has two deploy sets. Pin the live chain-945 set by reading the running app's runtime config or a live unitroller call. Do this before any write step.
2. **Substrate faucet captcha** — exact captcha type (hCaptcha/reCAPTCHA/Turnstile) unknown until the page is driven; solver integration adapts to whichever. Rate limits unknown → backoff + per-account proxy.
3. **EVM faucet route** — `devnetFaucet` request/response shape must be captured from a live network trace (browser devtools or proxied run) before wiring `faucet-evm.ts`.
4. **Bridge mechanism** — confirm whether mirror-SS58 transfer is sufficient or whether a precompile/`bridge.bittensor.com` flow is required on this testnet; validate with one account first.
5. **Warp method** — confirm exact contract + method (`deposit` on wsTAO vs WTAO) from a live tx trace.
