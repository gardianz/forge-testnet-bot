# Forge live verification notes

Updated: 2026-06-29 (read-only verification run from the bot repo).

## Network (confirmed)

- EVM RPC: `https://test.chain.opentensor.ai` — reachable, `getChainId()` → **945**.
- EVM explorer: `https://evm-testscan.dev.opentensor.ai`.
- Substrate RPC: `wss://test.finney.opentensor.ai:443`.

## Verified addresses (live = CONTRACT, chain 945)

The app bundle ships **two** deploy sets. The LIVE set (all five return bytecode;
comptroller answers `getAllMarkets()`):

| Name | Address | Check |
|---|---|---|
| WTAO | `0x757bbFffe6f08FEbBE19638833FfADaa7B369C25` | CONTRACT, symbol=WTAO, decimals=18 |
| wsTAO | `0xcff46eb93307ca7E24A7cE2A1Eb0F485A27D461a` | CONTRACT, symbol=wsTAO, decimals=18 |
| vWTAO | `0x306065C8277ef65741B1CBeB095d755aF4B4b7cf` | CONTRACT, markets[0] |
| vWsTAO | `0x782E5a6Dc16901ec13D4D1e450A8270F4e6E75cf` | CONTRACT, in getAllMarkets() |
| comptroller (unitroller) | `0x999C6a7ee03aE0C0a18503C2ECA0C8d5a9f69f31` | CONTRACT, getAllMarkets ok |

> The stale set (do NOT use): WTAO `0xBfd66…`, vWTAO `0xA097…`, comptroller `0x10C6E9…` — all return EMPTY on chain 945.

Both TAO tokens use **18 decimals on EVM**. Substrate TAO uses **9 decimals (rao)** —
bridge planck conversion must use `parseUnits(x, 9)` (see Task 14 note).

## Still requires a live capture (funded account / browser)

These are NOT yet confirmed; capture before enabling the matching write step:

1. **EVM faucet (Task 15)** — exact route + request body of the Forge in-app
   `devnetFaucet`. Capture from the site's network trace when clicking
   "Claim EVM faucet". Fill into `src/steps/faucet-evm.ts`.
2. **Warp method (Task 9)** — RESOLVED by bytecode probe: wsTAO is an ERC20
   wrapper exposing `wrap(uint256)` (selector `0xea598cb0`); it also has
   `approve`/`transfer`/`balanceOf`. No `deposit*` selectors present. Flow:
   `WTAO.approve(wsTAO, amount)` then `wsTAO.wrap(amount)`. Still worth one live
   tx to confirm it pulls WTAO (not native) and the exact amount semantics.
3. **Bridge mapping (Task 14)** — confirm that sending native TAO to
   `h160ToMirrorSs58(h160)` credits the EVM balance on this testnet (vs a
   precompile / bridge.bittensor.com flow). Validate with one manual SS58→H160
   bridge, then keep or fix `src/substrate.ts`.
4. **Substrate faucet (Task 16)** — captcha type on taoswap testnet faucet
   (hCaptcha / reCAPTCHA / Turnstile) + form field names. Capture by loading the
   page; wire the solver provider accordingly.
