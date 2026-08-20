import * as THREE from 'three';

// There are no real lights in this scene.
//
// The brief is explicit that individual sparks must not be point lights, and
// once you accept that, a single analytic "ember light" shared by every hero
// material is both cheaper and easier to art-direct than three's light rig.
// Every custom material references these *same* uniform objects, so moving the
// fireball relights the hand, the paper cord and the smoke in one assignment.

export function createLightRig() {
  const shared = {
    uEmberPos: { value: new THREE.Vector3(0, 0, 0) },
    uEmberColor: { value: new THREE.Color(1.0, 0.52, 0.16) },
    uEmberPower: { value: 0.0 },
    uSkyColor: { value: new THREE.Color(0.052, 0.070, 0.132) },
    uGroundColor: { value: new THREE.Color(0.020, 0.021, 0.030) },
    uKeyDir: { value: new THREE.Vector3(-0.72, 0.28, 0.62).normalize() },
    uKeyColor: { value: new THREE.Color(0.115, 0.062, 0.030) },
  };

  return {
    shared,
    /** Attach the rig to a uniforms object so the material tracks it live. */
    bind(uniforms) {
      for (const k of Object.keys(shared)) uniforms[k] = shared[k];
      return uniforms;
    },
    setEmber(pos, power, temp) {
      shared.uEmberPos.value.copy(pos);
      shared.uEmberPower.value = power;
      // Hotter beads throw whiter light. Cool ones go deep orange-red.
      const t = Math.min(1, Math.max(0, temp));
      shared.uEmberColor.value.setRGB(1.0, 0.30 + t * 0.42, 0.055 + t * 0.30);
    },
  };
}
