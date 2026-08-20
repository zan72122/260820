type Handler<T> = (payload: T) => void;

/** Minimal typed event bus. Keeps systems (audio, camera, hints) decoupled
 *  from the state machine that drives them. */
export class Signals<M extends Record<string, unknown>> {
  private map = new Map<keyof M, Set<Handler<any>>>();

  on<K extends keyof M>(key: K, fn: Handler<M[K]>): () => void {
    let set = this.map.get(key);
    if (!set) { set = new Set(); this.map.set(key, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
  }

  emit<K extends keyof M>(key: K, payload: M[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  clear(): void {
    this.map.clear();
  }
}
