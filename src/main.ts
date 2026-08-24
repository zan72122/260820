import { GameFlow } from './game/GameFlow';
import { flags } from './core/runtimeFlags';

/**
 * ひとつの心臓、四つの窓
 *
 * One heart in a training manikin, four places on the chest, and a child
 * finding out with their own ears that the same two sounds arrive differently
 * depending on where the chestpiece is resting.
 */
const game = new GameFlow();
game.start();

// Keep the reference alive for Safari's aggressive page-cache behaviour.
(window as unknown as { __game?: GameFlow }).__game = game;

// `?selftest=1` renders the real audio graph offline and reports what the four
// areas actually measure. Loaded on demand, so it never ships in the game path.
if (flags.selfTest) {
  void import('./audio/selfTest').then(async ({ runAudioSelfTest }) => {
    const result = await runAudioSelfTest();
    (window as unknown as { __audioSelfTest?: unknown }).__audioSelfTest = result;
  });
}
