/**
 * Runtime switches read once from the URL.
 *
 * `fast` is the profile used by the headless browser check and by any device
 * that cannot keep up: it drops the pixel ratio, the shadow pass and the
 * softest lights, but never the material response that the close-ups depend on.
 */
export interface RuntimeFlags {
  fast: boolean;
  selfTest: boolean;
}

function read(): RuntimeFlags {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams();
  }
  const on = (k: string) => params.get(k) === '1' || params.get(k) === 'true';
  return { fast: on('fast'), selfTest: on('selftest') };
}

export const flags: RuntimeFlags = read();
