# Forge Testnet Bot

One idempotent, multi-account daily bot for the Forge Lending testnet on
**Bittensor EVM (chain 945)**. Single pipeline — faucets run inline, no separate
faucet bot:

```
faucet-devnet → faucet-substrate → bridge → warp → supply → collateral
→ borrow → repay → redeem
```

- **faucet-devnet** — claims the Forge devnet faucet **daily** (mints the mock
  tokens shown on `/#/devnet-faucet?chainId=945`: ALPHA30, ALPHA64, Endure,
  wAL-333, Score, WTAO). Date-gated so it fires once per UTC day.
- **faucet-substrate** — claims the taoswap TAO faucet **only when** the SS58
  balance can't cover the bridge transfer + fee. Browser-free: solves the
  Cloudflare Turnstile via the captcha provider, then POSTs the claim directly to
  the taoswap API (verified live — claims 1 TAO).
- **lending loop** — bridge SS58→H160, warp TAO→wsTAO, supply, add CF>0
  collateral, borrow, then repay + redeem (recycle).

Every step checks on-chain state first and **skips when already done**, so runs
are resumable and safe to repeat.

## Setup

```bash
npm install
cp config.example.yaml config.yaml   # edit thresholds, faucetDevnet, dryRun
cp .env.example .env                 # ACCOUNTS_KEY, CAPTCHA_API_KEY, TELEGRAM_*
cp proxy.txt.example proxy.txt       # optional: one proxy per account (see below)
```

`CAPTCHA_API_KEY` (2captcha/anticaptcha) is only needed for the taoswap substrate
faucet (Cloudflare Turnstile). No browser/Playwright required.

`accounts.json` — a JSON array (or a crypto-js blob encrypted with `ACCOUNTS_KEY`).
Each account provides separate keys (`evmPk` + `substrateSeed`) or a single
`mnemonic` used for both:

```json
[{ "id": "acc1", "evmPk": "0x…", "substrateSeed": "word1 … word12", "proxy": "http://user:pass@host:port" }]
```

### Generate wallets

Create fresh, ready-to-use accounts and append them to `accounts.json` (each gets
a new 12-word mnemonic; the bot derives EVM H160 + substrate SS58 from it):

```bash
npm run gen -- 5            # generate 5 new wallets (or: tsx src/main.ts --gen 5)
```

It prints each new wallet's **public** H160 / SS58 / mirror-SS58 (secrets stay in
the gitignored file). Numbering continues from existing ids (`acc2`, `acc3`, …).
A fresh wallet bootstraps itself: the taoswap faucet (captcha-only, no gas) funds
the SS58, the bridge step turns that into EVM gas, then the rest of the pipeline
runs — so right after `gen` you can `npm run bot:live`.

### Proxies (`proxy.txt`)

One proxy per line, mapped to accounts **by index** (line 1 → account 1). Blank
lines and `#` comments are ignored; bare `host:port` is treated as HTTP. A
`proxy.txt` entry **overrides** the `proxy` field in `accounts.json`. Each
account's EVM RPC calls and the taoswap faucet POST run through its own proxy.

```
http://user:pass@1.2.3.4:8080
socks5://user:pass@5.6.7.8:1080
9.10.11.12:3128
```

## Run

```bash
npm run check         # read-only: per-account balances + step state
npm run bot           # run the pipeline once (dryRun per config) with the dashboard
npm run bot:dry       # force dry-run (simulate, no broadcast)
npm run bot:live      # go live (broadcast)
npm run schedule      # daily at a FIXED time (scheduleCron)
npm run daemon        # 24/7: run once per day at a RANDOM time
npm run verify        # read-only live deployment check

npx tsx src/main.ts --step warp --account acc1 --no-dry-run   # single step (debug)
npx tsx src/main.ts --no-dashboard                            # plain line logs
```

### Run 24/7 with random daily timing

`npm run daemon` stays up and runs the whole pipeline once per "day" at a
**random gap** in `daemon.minHours`–`daemon.maxHours` (default 22–26h), so the run
drifts to a different clock time each day. `accountJitterMs` adds a random delay
before each account and shuffles the order, so accounts don't act in lockstep.

Keep it alive across logout/reboot with a process manager:

```bash
# quick: nohup (logs to nohup.out)
nohup npm run daemon &

# better: pm2
pm2 start "npm run daemon" --name forge-bot && pm2 save

# or systemd / tmux / screen
```

`--schedule` (fixed cron) and `--daemon` (random) are alternatives — pick one.

### Terminal dashboard

On a TTY the bot draws a live dashboard: a per-account balance table
(gas / subTAO / wsTAO / vToken / borrow + proxy), a compact step-status grid, and
a tail of the run log. On a non-TTY (cron, redirected output) the dashboard
auto-disables and falls back to line logging. Every run is also tee'd to
`logs/run-<date>.log`. Force on/off with `--dashboard` / `--no-dashboard`.

## Verified live

All mechanics are **verified live** — see
`docs/superpowers/specs/forge-live-notes.md` for the confirmed flow, the full
devnet-faucet token map, the taoswap claim API, and tx hashes. The taoswap
substrate faucet is confirmed too (claimed 1 TAO via Turnstile solve + direct
POST).

Safety: `dryRun: true` by default; writes require `--no-dry-run`. Every write
asserts chainId 945 and refuses any other chain. `accounts.json`, `config.yaml`,
`proxy.txt`, `.env`, `state/`, `logs/` are gitignored.

## Test

```bash
npm test          # unit tests (mocked clients)
npm run typecheck
```
