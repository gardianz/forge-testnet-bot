import { runBot } from './bot-runner.ts';
import { FAUCET_STEPS } from './runner.ts';

// Faucet bot: claim substrate TAO (taoswap) + EVM faucet tokens. Daily.
runBot('faucet', FAUCET_STEPS, 'faucetCron').catch((e) => {
  console.error(e);
  process.exit(1);
});
