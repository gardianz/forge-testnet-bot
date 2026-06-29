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

## Two bots (run daily)

- **faucet-bot** — claim substrate TAO (taoswap) + mint EVM faucet token. `faucetCron`.
- **main-bot** — bridge SS58→H160, warp TAO→wsTAO, supply, collateral, borrow, repay, redeem. `mainCron`.

Each account provides separate keys: `evmPk` (EVM signer) + `substrateSeed` (substrate signer), or a single `mnemonic` for both.

```bash
npm run check                    # read-only status: balances + per-step state

npm run faucet                   # faucet bot once (dryRun per config)
npm run main                     # main bot once
tsx src/faucet-bot.ts --no-dry-run   # go live: claim faucets
tsx src/main-bot.ts --no-dry-run     # go live: bridge/warp/supply/borrow/repay/redeem

npm run faucet:schedule          # daily faucet bot (faucetCron)
npm run main:schedule            # daily main bot (mainCron)

tsx src/main.ts --step warp --account acc1 --no-dry-run   # single step (debug)
```

All on-chain mechanics are **verified live** — see `docs/superpowers/specs/forge-live-notes.md` for the confirmed flow + tx hashes. The only untested path is the taoswap substrate faucet (the test account was pre-funded); its Playwright + 2captcha selectors need tuning on a fresh account.

Safety: `dryRun: true` by default; writes require `--no-dry-run`. Every write
asserts chainId 945 and refuses any other chain. `accounts.json`, `config.yaml`,
`.env`, `state/`, `logs/` are gitignored.

## Test

```bash
npm test          # unit tests (mocked clients)
npm run typecheck
```
