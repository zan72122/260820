type Handler<T> = (payload: T) => void;

/** Minimal typed event hub; the sim modules never import each other directly. */
export class Signal<T = void> {
  private handlers: Handler<T>[] = [];

  on(fn: Handler<T>): () => void {
    this.handlers.push(fn);
    return () => this.off(fn);
  }

  off(fn: Handler<T>): void {
    const i = this.handlers.indexOf(fn);
    if (i >= 0) this.handlers.splice(i, 1);
  }

  emit(payload: T): void {
    for (const fn of this.handlers.slice()) fn(payload);
  }
}
