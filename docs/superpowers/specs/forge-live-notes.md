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

## CONFIRMED LIVE (2026-06-29, full run on one funded account)

All write mechanics verified end-to-end with real testnet txs:

1. **EVM faucet** = **mint the mock tokens**. `devnetFaucet` in the bundle is
   only the menu route label, NOT an HTTP endpoint. WTAO (`0x757b…`) and the mock
   Alpha tokens expose an open `mint(address,uint256)` on testnet. Now handled by
   `src/steps/faucet-devnet.ts` (daily, multi-token; see the token map below).
   ✓ WTAO mint tx `0x2c5fa5da…`
2. **Bridge SS58→H160** = transfer native TAO to `h160ToMirrorSs58(h160)`
   (`blake2_256("evm:"+h160)` → ss58). Credits EVM native balance. ✓ bridged
   0.5 TAO, EVM gas rose 0.0989→0.598. Mapping in `src/substrate.ts` is correct.
3. **Warp** = wrap **native TAO** into wsTAO. wsTAO.wrap is **payable**
   `wrap(uint256 minSharesOut, uint256 deadline)` — send TAO as msg.value, get
   wsTAO shares (exchangeRate ≈ 1.0001). NOT WTAO. No approve. ✓ tx `0x3a3bc940…`
4. **Supply** = approve wsTAO → `vWsTAO.mint` → `enterMarkets`. ✓ tx `0x50c3fe6f…`
5. **Collateral / borrow** — wsTAO has **collateralFactor 0** (no borrow power).
   Borrowing requires an Alpha collateral with CF>0. mALPHA30 (`0x1D5E4617…`,
   vToken `0x037b37B4…`, CF 0.25) is openly mintable. `src/steps/collateral.ts`
   mints+supplies it, then borrow succeeds. ✓ collateral `0x0ec6bb8b…`,
   borrow 0.05 wsTAO `0xed2466b3…`, repay `0x4d939247…`.

## Devnet faucet token map (from app bundle `@endure/chains` testnet `Wi`)

The `/#/devnet-faucet?chainId=945` page mints mock tokens via an open
`mint(address,uint256)`. `src/steps/faucet-devnet.ts` mints these daily
(date-gated); each is simulate-guarded so a non-open-mint token is skipped
without spending gas.

| Faucet card | symbol | address |
|---|---|---|
| alpha-30 | ALPHA30 (mockAlpha30) | `0x1D5E4617ad59c1A4428526F6994410e513587a96` |
| alpha-64 | ALPHA64 (mockAlpha64) | `0xd36F494aC4D7dd5674c1a21B65FD4f5Fee14A8b4` |
| Endure | wAL-288 (wAlpha288V2) | `0x7e81f63a4CeA09040F111314a0E5Ff61249a51D7` |
| wAL-333 | wAL-333 (wAlpha333V2) | `0xC2f945887c3Ff61b3E5Aa7aDE291228a4B4c5d37` |
| Score | wAL-418 (wAlpha418V2) | `0x407F2BEb996d173e34C5EC495cC80a5271Bdb77d` |
| TAO | WTAO | `0x757bbFffe6f08FEbBE19638833FfADaa7B369C25` |

Live simulate probe (2026-06-29, `simulateContract` mint, no broadcast):

| token | open `mint(addr,amt)` |
|---|---|
| ALPHA30, ALPHA64, WTAO | ✓ OK — claimed daily |
| Endure (wAL-288), wAL-333, Score (wAL-418) | ✗ REVERT — not open-mint |

The wAL tokens are **wrapped subnet alpha**, not faucet-minted. The site "Get"
button does `approve(wrapperAddress, netuid, amount)` then
`wrap(amount, minAmountOut, deadline)` (bundle: `abi:Kl, functionName:"wrap"`),
sourcing alpha from `wAlphaStashFaucet`
(`0x35c23b26B3A6bF06a5ECdD7420e800dB7c7866Fe`). Claiming them needs the
per-netuid wrap flow + a stash claim — out of scope for the faucet step, which
mints only the open-mint tokens. The wAL entries are kept out of the default
config (the simulate-guard would just skip them).

## Architecture (current)

- **One bot, run daily** (`src/main.ts`). Faucets run inline — there is no
  separate faucet bot. `npm run schedule` = daily on `scheduleCron`.
- **taoswap faucet is conditional**: `faucet-substrate` claims only when the SS58
  free balance < bridge amount + `substrateFeeBuffer`.
- **Per-account proxies** via `proxy.txt` (line N → account N; overrides
  `accounts.json`). Routes EVM RPC (undici ProxyAgent) + Playwright.
- **Terminal dashboard** (`src/dashboard.ts`): live balance table + step grid +
  log tail on a TTY; auto line-log fallback on non-TTY; tee to `logs/run-*.log`.

## Substrate faucet (taoswap) — CONFIRMED LIVE (2026-06-29)

Reverse-engineered the SPA by intercepting `window.turnstile.render` (to capture
the callback) and logging all non-GET requests. The "Claim 1τ" submit is a plain
JSON POST — **no browser needed** for the bot:

- **Page**: `https://taoswap.org/testnet-faucet` (Angular SPA).
- **Captcha**: Cloudflare **Turnstile**, sitekey `0x4AAAAAADsYqTeKzaXU5Qhb`
  (explicit render: opts `[sitekey, theme, callback, expired-callback,
  error-callback]`; hidden input `name=cf-turnstile-response`). Solvable from
  sitekey+pageurl via 2captcha/anticaptcha.
- **Claim API**: `POST https://api.taoswap.org/testnet-faucet/`
  body `{"ss58_address":"<SS58>","amount":"1","captcha_token":"<turnstile>"}`.
  Response `201 {"success":true}`.
- **Result**: SS58 free balance rose by exactly `1_000_000_000` rao = **1 TAO**. ✓

`src/steps/faucet-substrate.ts` does: solve Turnstile → POST (through the account
proxy, with browser-like Origin/Referer/UA headers) → poll balance. The old
Playwright path is gone (dependency dropped). Gotcha discovered en route: passing
a function with a named inner arrow (`const f = () => …`) to `page.evaluate`
breaks under tsx/esbuild (`ReferenceError: __name is not defined`) — pass plain
strings to evaluate; moot now that the browser path is removed.

## Still untested / notes

- The RPC `https://test.chain.opentensor.ai` occasionally times out on
  `eth_getBlockByNumber` during receipt waits; steps are idempotent so a re-run
  settles any step left in that state.
