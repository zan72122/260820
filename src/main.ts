import { GameFlow } from './game/GameFlow';

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
