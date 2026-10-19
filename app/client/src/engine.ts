/**
 * PlaybackEngine — drives a YouTube player WITHOUT trusting its events.
 *
 * Why: inside some WebViews (Android/Capacitor) the iframe API's onReady /
 * onStateChange / getCurrentTime never arrive or always return 0. Everything the
 * UI needs (position, "track ended → play next", "next button works") therefore
 * runs on our own clock, and is corrected by real player data whenever it exists.
 *
 *  - commands are queued until the player exposes its methods (no dependency on onReady)
 *  - position = player time when available, otherwise a wall-clock estimate
 *  - end of track = player "ended" event OR position reaching the known duration
 */

export type PlayerLike = {
  loadVideoById?: (id: string) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume?: (volume: number) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getPlayerState?: () => number;
};

export type EngineHooks = {
  onEnded: () => void;
  onTime: (time: number, duration: number) => void;
  onPlaying: (playing: boolean) => void;
  onBuffering: (buffering: boolean) => void;
  onError?: (code: number) => void;
};

const SETTLE_MS = 1500; // ignore stale player data right after a load
const END_GUARD_MS = 3000; // never end a track within the first seconds of loading

export class PlaybackEngine {
  player: PlayerLike | null = null;
  volume = 80;
  /** true once the player has delivered at least one state event for this track. */
  eventsAlive = false;
  lastState = -2;
  lastError = 0;

  private pending: string | null = null;
  private loadedId: string | null = null;
  private epoch = 0;
  private endedEpoch = -1;
  private loadedAt = -1e9;
  private wantPlaying = false;
  private buffering = false;
  private base = 0;
  private startedAt: number | null = null;
  private knownDuration = 0;
  private realTime = 0;
  private lastEmit = "";

  constructor(
    private hooks: EngineHooks,
    private now: () => number = () => performance.now()
  ) {}

  /* ---- wiring ---- */

  attach(player: PlayerLike | null) {
    this.player = player;
    this.flush();
  }

  /** Player reported ready (optional — polling also detects availability). */
  ready() {
    this.flush();
    this.call("setVolume", this.volume);
  }

  hasMethods() {
    return typeof this.player?.loadVideoById === "function";
  }

  isLoaded(id: string) {
    return this.loadedId === id || this.pending === id;
  }

  get playing() {
    return this.wantPlaying;
  }

  /* ---- commands ---- */

  load(id: string, durationSec: number, autoplay = true) {
    this.epoch += 1;
    this.eventsAlive = false;
    this.endedEpoch = -1;
    this.loadedAt = this.now();
    this.knownDuration = durationSec;
    this.base = 0;
    this.realTime = 0;
    this.buffering = false;
    this.wantPlaying = autoplay;
    this.startedAt = autoplay ? this.now() : null;
    this.pending = id;
    this.loadedId = null;
    this.flush();
    this.hooks.onBuffering(false);
    this.hooks.onPlaying(autoplay);
    this.emit(0, durationSec, true);
  }

  play() {
    this.wantPlaying = true;
    this.startedAt = this.now();
    if (this.pending) this.flush();
    else this.call("playVideo");
    this.hooks.onPlaying(true);
  }

  pause() {
    this.base = this.position();
    this.startedAt = null;
    this.wantPlaying = false;
    this.call("pauseVideo");
    this.hooks.onPlaying(false);
  }

  seek(seconds: number) {
    const s = Math.max(0, seconds);
    this.call("seekTo", s, true);
    this.base = s;
    this.startedAt = this.wantPlaying && !this.buffering ? this.now() : null;
    if (this.knownDuration <= 0 || s < this.knownDuration - 2) this.endedEpoch = -1;
    this.loadedAt = Math.min(this.loadedAt, this.now() - SETTLE_MS); // trust player data again soon
    this.emit(s, this.duration(), true);
  }

  setVolume(v: number) {
    this.volume = v;
    this.call("setVolume", v);
  }

  /* ---- events from the real player (all optional) ---- */

  onState(state: number) {
    this.lastState = state;
    this.eventsAlive = true;
    const since = this.now() - this.loadedAt;
    if (state === 1) {
      this.buffering = false;
      this.wantPlaying = true;
      this.base = this.realTime > 0 ? this.realTime : this.position();
      this.startedAt = this.now();
      this.hooks.onBuffering(false);
      this.hooks.onPlaying(true);
    } else if (state === 3) {
      this.base = this.position();
      this.startedAt = null; // freeze the clock while buffering
      this.buffering = true;
      this.hooks.onBuffering(true);
    } else if (state === 2) {
      // YouTube emits PAUSED while a new video is loading — ignore that transient.
      if (since > SETTLE_MS && this.wantPlaying) {
        this.base = this.position();
        this.startedAt = null;
        this.wantPlaying = false;
        this.hooks.onPlaying(false);
      }
    } else if (state === 0) {
      if (since > SETTLE_MS) this.finish();
    }
  }

  onError(code: number) {
    this.lastError = code;
    this.hooks.onError?.(code);
  }

  /* ---- periodic work (call every ~250ms) ---- */

  tick() {
    this.flush();
    if (!this.loadedId && !this.pending) return;
    const now = this.now();
    const since = now - this.loadedAt;
    const real = this.read("getCurrentTime");
    const apiDuration = this.read("getDuration");
    const duration = apiDuration > 1 ? apiDuration : this.knownDuration;

    this.realTime = real;
    // Trust the player's clock once it settled (stale values from the previous track are ignored).
    if (real > 0.05 && (since > SETTLE_MS || real < 3)) {
      this.base = real;
      this.startedAt = this.wantPlaying && !this.buffering ? now : null;
    }

    const t = this.position();
    this.emit(t, duration);

    if (this.wantPlaying && duration > 5 && this.endedEpoch !== this.epoch && since > END_GUARD_MS) {
      // If the player talks to us, give it a moment to fire its own "ended" first.
      const limit = this.eventsAlive ? duration + 1.5 : duration - 0.3;
      if (t >= limit) this.finish();
    }
  }

  /* ---- internals ---- */

  position() {
    return this.base + (this.startedAt !== null ? (this.now() - this.startedAt) / 1000 : 0);
  }

  private duration() {
    const d = this.read("getDuration");
    return d > 1 ? d : this.knownDuration;
  }

  private finish() {
    if (this.endedEpoch === this.epoch) return;
    this.endedEpoch = this.epoch;
    this.wantPlaying = false;
    this.startedAt = null;
    this.hooks.onEnded();
  }

  private flush() {
    if (!this.pending) return;
    const id = this.pending;
    if (this.call("loadVideoById", id)) {
      this.pending = null;
      this.loadedId = id;
      this.call("setVolume", this.volume);
      this.loadedAt = this.now();
      if (!this.wantPlaying) this.call("pauseVideo");
    }
  }

  private call(name: keyof PlayerLike, ...args: unknown[]): boolean {
    const p = this.player as Record<string, unknown> | null;
    const fn = p?.[name];
    if (typeof fn !== "function") return false;
    try {
      (fn as (...a: unknown[]) => void).apply(p, args);
      return true;
    } catch {
      return false;
    }
  }

  private read(name: "getCurrentTime" | "getDuration"): number {
    const p = this.player as Record<string, unknown> | null;
    const fn = p?.[name];
    if (typeof fn !== "function") return 0;
    try {
      const v = Number((fn as () => number).call(p));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  private emit(t: number, d: number, force = false) {
    const key = `${Math.floor(t * 4)}|${Math.floor(d)}`;
    if (!force && key === this.lastEmit) return;
    this.lastEmit = key;
    this.hooks.onTime(t, d);
  }
}
