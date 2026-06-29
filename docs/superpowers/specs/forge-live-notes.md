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

1. **EVM faucet** = **mint the mock collateral token**. `devnetFaucet` in the
   bundle is only the menu route label, NOT an HTTP endpoint. WTAO (`0x757b…`)
   and the mock Alpha tokens expose an open `mint(address,uint256)` on testnet.
   `src/steps/faucet-evm.ts` mints WTAO (cfg.evmFaucet). ✓ tx `0x2c5fa5da…`
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

## Still untested

- **Substrate faucet (taoswap)** — the live test account was already funded
  (10 TAO), so `faucet-substrate.ts` skipped. The Playwright + 2captcha path
  (selectors, captcha sitekey) is unverified; tune on a fresh, unfunded account.
- The RPC `https://test.chain.opentensor.ai` occasionally times out on
  `eth_getBlockByNumber` during receipt waits; steps are idempotent so a re-run
  settles any step left in that state.
