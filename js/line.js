/* A polyline drawn with a constant width in screen pixels.
   A 1px GL line is invisible on a retina phone and a cylinder tube gets
   thinner as it recedes — for a 4-year-old the fishing line has to stay
   readable at every depth, so it is expanded in clip space instead. */
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSide;
  attribute float aEndSel;
  uniform vec2  uRes;      // drawing buffer size in px
  uniform float uWidth;    // px
  varying float vEdge;
  void main(){
    vec4 cs = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
    vec4 ce = projectionMatrix * modelViewMatrix * vec4(aEnd,   1.0);
    // keep segments that straddle the near plane from flipping
    if (cs.w < 0.0001) cs = mix(cs, ce, (0.0001 - cs.w) / (ce.w - cs.w));
    if (ce.w < 0.0001) ce = mix(ce, cs, (0.0001 - ce.w) / (cs.w - ce.w));
    vec2 ps = cs.xy / cs.w * uRes * 0.5;
    vec2 pe = ce.xy / ce.w * uRes * 0.5;
    vec2 dir = pe - ps;
    float l = length(dir);
    dir = l > 0.0001 ? dir / l : vec2(0.0, 1.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 clip = mix(cs, ce, aEndSel);
    vec2 off = nrm * aSide * uWidth * 0.5;
    clip.xy += off / (uRes * 0.5) * clip.w;
    vEdge = aSide;
    gl_Position = clip;
  }`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vEdge;
  void main(){
    // soften the two long edges so the line never looks like a jaggy staircase
    float a = 1.0 - smoothstep(0.30, 1.0, abs(vEdge));
    gl_FragColor = vec4(uColor, uOpacity * a);
    #include <colorspace_fragment>
  }`;

export class ScreenLine extends THREE.Mesh {
  constructor(count, { color = 0xffffff, width = 3, opacity = 1, depthWrite = false } = {}) {
    const segs = count - 1;
    const geo = new THREE.BufferGeometry();
    const start = new Float32Array(segs * 6 * 3);
    const end = new Float32Array(segs * 6 * 3);
    const side = new Float32Array(segs * 6);
    const endSel = new Float32Array(segs * 6);
    // two triangles per segment: (s-,s+,e-) (e-,s+,e+)
    const S = [-1, 1, -1, -1, 1, 1];
    const E = [0, 0, 1, 1, 0, 1];
    for (let i = 0; i < segs; i++) {
      for (let k = 0; k < 6; k++) { side[i * 6 + k] = S[k]; endSel[i * 6 + k] = E[k]; }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 6 * 3), 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('aEndSel', new THREE.BufferAttribute(endSel, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uWidth: { value: width },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite, depthTest: true,
      side: THREE.DoubleSide,
    });
    super(geo, mat);
    this.frustumCulled = false;
    this.count = count;
    this._start = start;
    this._end = end;
  }

  /** points: array of THREE.Vector3, length === count */
  setPoints(points) {
    const s = this._start, e = this._end;
    for (let i = 0; i < this.count - 1; i++) {
      const a = points[i], b = points[i + 1];
      for (let k = 0; k < 6; k++) {
        const o = (i * 6 + k) * 3;
        s[o] = a.x; s[o + 1] = a.y; s[o + 2] = a.z;
        e[o] = b.x; e[o + 1] = b.y; e[o + 2] = b.z;
      }
    }
    this.geometry.attributes.aStart.needsUpdate = true;
    this.geometry.attributes.aEnd.needsUpdate = true;
  }

  setResolution(w, h) { this.material.uniforms.uRes.value.set(w, h); }
  set width(px) { this.material.uniforms.uWidth.value = px; }
  get width() { return this.material.uniforms.uWidth.value; }
  set opacity(o) { this.material.uniforms.uOpacity.value = o; }
  get color() { return this.material.uniforms.uColor.value; }
}
