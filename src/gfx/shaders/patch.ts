import type { WebGLProgramParametersWithUniforms } from 'three';
import { Material } from 'three';

export type Shader = WebGLProgramParametersWithUniforms;

/** Replace a three.js shader chunk include, keeping the original if asked. */
export function replaceChunk(src: string, chunk: string, code: string): string {
  const token = `#include <${chunk}>`;
  if (!src.includes(token)) {
    throw new Error(`shader chunk not found: ${chunk}`);
  }
  return src.replace(token, code);
}

export function beforeChunk(src: string, chunk: string, code: string): string {
  return replaceChunk(src, chunk, `${code}\n#include <${chunk}>`);
}

export function afterChunk(src: string, chunk: string, code: string): string {
  return replaceChunk(src, chunk, `#include <${chunk}>\n${code}`);
}

/**
 * three caches compiled programs per material signature; two materials that
 * differ only by our injected code would otherwise share a program. Tag them.
 */
export function tagProgram(material: Material, key: string): void {
  material.customProgramCacheKey = () => key;
}
