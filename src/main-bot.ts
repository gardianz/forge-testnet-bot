import { runBot } from './bot-runner.ts';
import { MAIN_STEPS } from './runner.ts';

// Main bot: bridge substrate->EVM, warp, supply, borrow, repay, redeem. Daily.
runBot('main', MAIN_STEPS, 'mainCron').catch((e) => {
  console.error(e);
  process.exit(1);
});
