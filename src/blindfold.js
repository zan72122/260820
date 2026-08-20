/**
 * The blindfold.
 *
 * This is a rendering effect, not a black screen. The design rule is strict:
 * the player must never think "nothing is happening", only "I can't see, but I
 * can still move". So the cloth transmits a heavily blurred, dimmed, desaturated
 * version of the real frame — enough to read bright sky above and dark sand
 * below — and it never quite reaches the bottom of the screen, leaving a narrow
 * gap where the player's own feet and the sand right in front of them stay
 * visible.
 *
 * Pipeline: scene → sceneRT, then two cheap separable blur passes at 1/6
 * resolution, then one composite. The low resolution is the blur.
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { makeClothMaps } from './textures.js';

const BLUR_DIV = 6;

export class Blindfold {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.amount = 0;              // 0 = no cloth at all, 1 = fully down
    this.sway = 0;
    this.time = 0;

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    this.blurA = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });
    this.blurB = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });
    for (const rt of [this.sceneRT, this.blurA, this.blurB]) {
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.generateMipmaps = false;
    }

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform vec2 uDir;
        varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv) * 0.2270270;
          c += texture2D(tDiffuse, vUv + uDir * 1.3846153) * 0.3162162;
          c += texture2D(tDiffuse, vUv - uDir * 1.3846153) * 0.3162162;
          c += texture2D(tDiffuse, vUv + uDir * 3.2307692) * 0.0702702;
          c += texture2D(tDiffuse, vUv - uDir * 3.2307692) * 0.0702702;
          gl_FragColor = c;
        }
      `,
      depthTest: false, depthWrite: false,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBlur: { value: null },
        tCloth: { value: makeClothMaps(quality.clothTexture) },
        uDrop: { value: 0 },
        uTime: { value: 0 },
        uSway: { value: 0 },
        uAspect: { value: 1 },
        uExposure: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene, tBlur, tCloth;
        uniform float uDrop, uTime, uSway, uAspect, uExposure;
        varying vec2 vUv;

        // Rendering into a render target skips three's tone mapping and output
        // encoding, so this pass has to finish the job itself.
        vec3 rrt(vec3 v){
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return a / b;
        }
        vec3 aces(vec3 c){
          const mat3 IN = mat3(0.59719, 0.07600, 0.02840,
                               0.35458, 0.90834, 0.13383,
                               0.04823, 0.01566, 0.83777);
          const mat3 OUT = mat3( 1.60475, -0.10208, -0.00327,
                                -0.53108,  1.10813, -0.07276,
                                -0.07367, -0.00605,  1.07602);
          c *= uExposure / 0.6;
          c = IN * c;
          c = rrt(c);
          c = OUT * c;
          return clamp(c, 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92,
                     vec3(lessThanEqual(c, vec3(0.0031308))));
        }

        void main(){
          vec3 clear = aces(texture2D(tScene, vUv).rgb);

          // the hem of the cloth: it slides down from the top and, once down,
          // still leaves a narrow strip of real vision at the player's feet.
          float hemWobble = sin(vUv.x * 9.0 + uTime * 1.6) * 0.012
                          + sin(vUv.x * 3.1 - uTime * 0.9) * 0.018 * uSway;
          float hem = mix(1.10, 0.062, uDrop) + hemWobble * uDrop;
          float cover = smoothstep(hem - 0.012, hem + 0.030, vUv.y);
          if (cover <= 0.001) { gl_FragColor = vec4(toSRGB(clear), 1.0); return; }

          vec3 blur = aces(texture2D(tBlur, vUv).rgb);

          // light creeping in under the hem and around the edges of the face
          float under = exp(-max(vUv.y - hem, 0.0) * 6.5);
          float sides = exp(-min(vUv.x, 1.0 - vUv.x) * 7.0);
          float leak = clamp(under * 0.85 + sides * 0.22, 0.0, 1.0);

          // fabric: weave + soft folds that shift a little as the head moves
          vec2 cuv = vUv * vec2(3.4 * uAspect, 3.4) + vec2(uSway * 0.05, uDrop * 0.02);
          float weave = texture2D(tCloth, cuv).r;
          float folds = 0.5 + 0.5 * sin(vUv.x * 12.0 + uSway * 2.2 + sin(vUv.y * 3.0) * 1.4);

          // What actually gets through the cotton: dim, nearly colourless, very
          // soft — but with the contrast pushed UP, not down. Flattening it is
          // what turns "I can't see" into "there is nothing there"; the player
          // still has to be able to tell bright sky from dark sand from the
          // dark shapes of the people calling.
          vec3 through = blur;
          float lum = dot(through, vec3(0.299, 0.587, 0.114));
          through = mix(vec3(lum), through, 0.22);
          through = clamp((through - 0.45) * 1.9 + 0.34, vec3(0.0), vec3(1.6));
          through *= vec3(0.84, 0.90, 1.0);                       // indigo cotton
          through *= (0.105 + leak * 0.70);

          // the cloth's own colour, lit by the sun behind it
          vec3 tint = vec3(0.30, 0.24, 0.28) * (0.55 + weave * 0.75) * (0.75 + folds * 0.35);
          vec3 cloth = through + tint * (0.030 + leak * 0.22) + vec3(0.016, 0.013, 0.014);

          // vignette towards the nose bridge / temples
          float vig = 1.0 - smoothstep(0.30, 0.95, length((vUv - vec2(0.5, 0.52)) * vec2(1.1, 1.0)));
          cloth *= 0.26 + vig * 0.80;

          gl_FragColor = vec4(toSRGB(mix(clear, cloth, cover)), 1.0);
        }
      `,
      depthTest: false, depthWrite: false,
    });

    this.quad = new FullScreenQuad(this.blurMat);
  }

  setSize(w, h, pixelRatio) {
    const W = Math.max(2, Math.floor(w * pixelRatio));
    const H = Math.max(2, Math.floor(h * pixelRatio));
    this.sceneRT.setSize(W, H);
    const bw = Math.max(2, Math.floor(W / BLUR_DIV));
    const bh = Math.max(2, Math.floor(H / BLUR_DIV));
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
    this.compositeMat.uniforms.uAspect.value = w / h;
    this._bw = bw; this._bh = bh;
  }

  get active() { return this.amount > 0.001; }

  render(scene, camera, dt) {
    const r = this.renderer;
    this.time += dt;

    if (!this.active) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }

    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    this.quad.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.blurMat.uniforms.uDir.value.set(1.6 / this._bw, 0);
    r.setRenderTarget(this.blurA);
    this.quad.render(r);

    this.blurMat.uniforms.tDiffuse.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1.6 / this._bh);
    r.setRenderTarget(this.blurB);
    this.quad.render(r);

    this.quad.material = this.compositeMat;
    const u = this.compositeMat.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBlur.value = this.blurB.texture;
    u.uDrop.value = this.amount;
    u.uTime.value = this.time;
    u.uSway.value = this.sway;
    u.uExposure.value = r.toneMappingExposure;
    r.setRenderTarget(prevTarget);
    this.quad.render(r);
  }

  dispose() {
    this.sceneRT.dispose(); this.blurA.dispose(); this.blurB.dispose();
    this.quad.dispose();
  }
}
