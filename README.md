# Forge Testnet Bot

Multi-account, idempotent bot for the Forge Lending testnet checklist on
**Bittensor EVM (chain 945)**:

```
substrate faucet → bridge SS58→H160 → EVM faucet → warp (WTAO→wsTAO)
→ supply → borrow → repay → redeem
```

Hybrid: Playwright drives only the captcha-gated substrate faucet; everything
else is on-chain (viem + polkadot.js). Every step checks on-chain state first and
**skips when already done**, so runs are resumable and safe to repeat.

## Setup

```bash
npm install
npx playwright install chromium      # only needed for the substrate faucet step
cp config.example.yaml config.yaml   # edit thresholds, marketToken, dryRun
cp .env.example .env                 # set ACCOUNTS_KEY, CAPTCHA_API_KEY, TELEGRAM_*
```

Create `accounts.json` — a JSON array, or a crypto-js blob encrypted with
`ACCOUNTS_KEY`. Each entry provides a BIP39 mnemonic; the bot derives both the
EVM H160 (`m/44'/60'/0'/0/0`) and the substrate SS58 (sr25519, ss58Format 42):

```json
[{ "id": "acc1", "mnemonic": "word1 ... word12", "proxy": "http://user:pass@host:port" }]
```

## Before first real run — verify live deployment

```bash
npm run verify        # read-only: confirms chain 945 + pins live contract set
```

Then capture the three remaining live-only values and fill them in (see
`docs/superpowers/specs/forge-live-notes.md`):

1. **EVM faucet** — the Forge "Faucet" page does an on-chain mint. Capture the
   claim tx, set `evmFaucet: { address, method, passAddress }` in `config.yaml`.
2. **Bridge** — confirm sending TAO to the H160 mirror-SS58 credits EVM balance.
3. **Substrate faucet** — confirm taoswap captcha type + page selectors.

## Run

```bash
npm run check                    # read-only status: balances + per-step state
npm run run:once                 # full pipeline, dryRun (simulate, no broadcast)
tsx src/main.ts --once --no-dry-run --account acc1   # go live on ONE account first
tsx src/main.ts --once --no-dry-run                  # then all accounts
tsx src/main.ts --schedule                           # daily cron (scheduleCron)
tsx src/main.ts --step warp --account acc1           # run a single step (debug)
```

Safety: `dryRun: true` by default; writes require `--no-dry-run`. Every write
asserts chainId 945 and refuses any other chain. `accounts.json`, `config.yaml`,
`.env`, `state/`, `logs/` are gitignored.

## Test

```bash
npm test          # unit tests (mocked clients)
npm run typecheck
```
