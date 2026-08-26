/** 実行時の描画バックエンドの違いを一箇所に閉じ込める。 */
export const caps = {
  /** 生のGLSL ShaderMaterial が使えるか（WebGL 2 経路） */
  rawShaders: true,
  backend: 'webgl2' as 'webgl2' | 'webgpu',
};
