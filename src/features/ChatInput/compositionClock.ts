/** Elapsed composition time, not a keystroke recorder; no text is retained. */
export class CompositionClock {
  private startedAt?: number;

  get start() {
    return this.startedAt;
  }

  restore(startedAt?: number) {
    this.startedAt =
      typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : undefined;
  }

  change(hasContent: boolean, now = Date.now()) {
    if (!hasContent) this.startedAt = undefined;
    else this.startedAt ??= now;
  }

  snapshot(now = Date.now()) {
    return {
      composedForMs:
        this.startedAt === undefined
          ? 0
          : Math.min(7 * 24 * 3600 * 1000, Math.max(0, now - this.startedAt)),
      sentAt: new Date(now).toISOString(),
    };
  }

  reset() {
    this.startedAt = undefined;
  }
}
