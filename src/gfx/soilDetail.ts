import * as THREE from 'three';

/**
 * Soil read at arm's length needs grain the tiling texture cannot give.
 * A second, much finer sample of the same maps adds grit and, as a side
 * effect, hides the repeat of the coarse one.
 */
export function addSoilDetail(mat: THREE.MeshStandardMaterial, uv = 'vMapUv', detailScale = 4.7) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'diffuseColor *= sampledDiffuseColor;',
        `vec4 fineDiffuse = texture2D( map, ${uv} * ${detailScale.toFixed(1)} + 0.37 );
         diffuseColor *= sampledDiffuseColor * ( 0.70 + 0.62 * fineDiffuse.g );`,
      )
      .replace(
        'normal = normalize( tbn * mapN );',
        `vec3 fineN = texture2D( normalMap, ${uv} * ${detailScale.toFixed(1)} + 0.37 ).xyz * 2.0 - 1.0;
         mapN.xy += fineN.xy * 0.85;
         normal = normalize( tbn * normalize( mapN ) );`,
      )
      .replace(
        'normal = normalize( tbn * mapN2 );',
        `vec3 fineN2 = texture2D( normalMap, ${uv} * ${detailScale.toFixed(1)} + 0.37 ).xyz * 2.0 - 1.0;
         mapN2.xy += fineN2.xy * 0.85;
         normal = normalize( tbn * normalize( mapN2 ) );`,
      );
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${key ? key.call(mat) : 'std'}-soildetail`;
  return mat;
}
