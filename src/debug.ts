import * as THREE from 'three';
import { Game } from './game';
import { CameraRig } from './camera';

// Invisible programmatic hooks for tests and visual verification.
// Nothing here renders anything.

export interface SamHooks {
  state(): {
    state: string;
    stationIndex: number;
    letter: string | null;
    tableAngle: number;
    lightY: number;
    solved: boolean;
    solvedTable: boolean;
    leverUnlocked: boolean;
    closeness: number;
    cameraMode: string;
  };
  setTableAngle(rad: number): void;
  setLever(y: number): void;
  wheel(deltaRad: number): void;
  solveActive(): void;
  swipe(): void;
  goto(i: number): Promise<void>;
  snapCamera(): void;
  snapFront(): void;
  snapReveal(): void;
  lettersReady(): boolean;
  drawCalls(): number;
}

export function installTestHooks(game: Game, rig: CameraRig, renderer: THREE.WebGLRenderer): void {
  const hooks: SamHooks = {
    state: () => ({
      state: game.state,
      stationIndex: game.stationIndex,
      letter: game.active.spec?.letter ?? null,
      tableAngle: game.active.tableAngle,
      lightY: game.active.lightY,
      solved: game.active.solved,
      solvedTable: game.active.solvedTable,
      leverUnlocked: game.active.leverUnlocked,
      closeness: game.active.closeness(),
      cameraMode: rig.mode,
    }),
    setTableAngle: (rad: number) => {
      const st = game.active;
      st.tableAngle = st.tableTarget = rad;
      st.tableVel = 0;
    },
    setLever: (y: number) => {
      // set only the target so the physical carriage (and spotlight) follow
      game.active.lightTarget = y;
    },
    wheel: (d: number) => game.active.applyWheelDelta(d),
    solveActive: () => {
      const st = game.active;
      st.tableTarget = 0;
      st.tableAngle = 0.001;
      if (st.spec?.hasLever) {
        st.leverUnlocked = true;
        st.solvedTable = true;
        st.lightTarget = st.spec.lightY;
        st.lightY = st.spec.lightY + 0.001;
      }
    },
    swipe: () => game.advance(),
    goto: (i: number) => game.gotoStation(i),
    snapCamera: () => rig.snapToOperate(game.active.group.position.x),
    snapFront: () => rig.snapToFront(game.active.group.position.x),
    snapReveal: () => rig.snapToReveal(game.active.group.position.x),
    lettersReady: () => game.stations.every((s) => !!s.spec),
    drawCalls: () => renderer.info.render.calls,
  };
  (window as unknown as { __SAM__: SamHooks }).__SAM__ = hooks;
}
