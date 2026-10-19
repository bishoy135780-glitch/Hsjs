import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isNativeApp } from "./config";
import { PlaybackEngine, type PlayerLike } from "./engine";
import { nextIndex, prevIndex } from "./queue";
import { useLibrary } from "./store";
import { toast } from "./toast";
import type { RepeatMode, Track } from "./types";
import { parseDuration, readJson, writeJson } from "./util";

/* ------------------------- YouTube IFrame API ------------------------- */

type YTPlayer = PlayerLike & { destroy: () => void };
type YTApi = {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    }
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTApi> | null = null;
function loadYouTubeApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube API unavailable"));
      document.head.appendChild(script);
    }
    window.setTimeout(() => {
      if (!window.YT?.Player) reject(new Error("YouTube API timeout"));
    }, 10_000);
  }).catch(error => {
    apiPromise = null; // allow a later retry
    throw error;
  });
  return apiPromise;
}

/** Player creation attempts, tried in order if the previous one never becomes usable. */
const ATTEMPTS = [
  { name: "youtube.com", host: undefined as string | undefined, origin: true },
  { name: "youtube-nocookie.com", host: "https://www.youtube-nocookie.com", origin: true },
  { name: "no-origin", host: undefined as string | undefined, origin: false },
];

/**
 * Last-resort player: a plain embed iframe with no JS control. Pause/seek reload the
 * iframe at the right second; time/ending are handled by PlaybackEngine's own clock.
 */
class EmbedPlayer implements PlayerLike {
  private frame: HTMLIFrameElement | null = null;
  private id: string | null = null;
  constructor(
    private host: HTMLElement,
    private position: () => number
  ) {}
  private show(id: string, start: number) {
    this.hide();
    const frame = document.createElement("iframe");
    const origin = encodeURIComponent(window.location.origin);
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&start=${Math.floor(start)}&origin=${origin}`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.title = "YouTube";
    this.host.appendChild(frame);
    this.frame = frame;
  }
  private hide() {
    this.frame?.remove();
    this.frame = null;
  }
  loadVideoById = (id: string) => {
    this.id = id;
    this.show(id, 0);
  };
  playVideo = () => {
    if (this.id && !this.frame) this.show(this.id, this.position());
  };
  pauseVideo = () => this.hide();
  seekTo = (seconds: number) => {
    if (this.id && this.frame) this.show(this.id, seconds);
  };
  setVolume = () => {};
  destroy = () => this.hide();
}

/* ------------------------------ time store ----------------------------- */

type TimeState = { t: number; d: number };
let timeState: TimeState = { t: 0, d: 0 };
const timeSubs = new Set<() => void>();
function setTime(next: TimeState) {
  if (Math.abs(next.t - timeState.t) < 0.2 && next.d === timeState.d) return;
  timeState = next;
  timeSubs.forEach(fn => fn());
}
/** Current playback position — isolated so only progress bars re-render each tick. */
export function usePlayerTime(): TimeState {
  return useSyncExternalStore(
    fn => {
      timeSubs.add(fn);
      return () => {
        timeSubs.delete(fn);
      };
    },
    () => timeState
  );
}

/* ------------------------------ silent audio --------------------------- */

/** A looping silent <audio> keeps the browser/WebView media session alive in the background. */
function createSilentWavUrl() {
  const sampleRate = 8000;
  const dataSize = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataSize, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/* -------------------------------- context ------------------------------ */

export type Diagnostics = {
  mode: "starting" | "api" | "embed";
  attempt: string;
  reason: string;
  apiLoaded: boolean;
  methods: boolean;
  eventsAlive: boolean;
  lastState: number;
  lastError: number;
  position: number;
  origin: string;
  native: boolean;
};

type PlayerApi = {
  current: Track | null;
  queue: Track[];
  index: number;
  isPlaying: boolean;
  buffering: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  videoMode: boolean;
  sourceLabel: string;
  playTrack: (track: Track, queue?: Track[], label?: string) => void;
  playList: (tracks: Track[], opts?: { shuffle?: boolean; label?: string }) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  jumpTo: (index: number) => void;
  setVideoMode: (on: boolean) => void;
  setVideoSlot: (el: HTMLElement | null) => void;
  getDiagnostics: () => Diagnostics;
};

const Ctx = createContext<PlayerApi | null>(null);
const STORE_KEY = "ymusic-player-v2";

type Saved = {
  queue: Track[];
  index: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  label: string;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { pushRecent } = useLibrary();
  const saved = useMemo(
    () =>
      readJson<Saved>(STORE_KEY, {
        queue: [],
        index: 0,
        volume: 80,
        shuffle: false,
        repeat: "off",
        label: "",
      }),
    []
  );

  const [queue, setQueue] = useState<Track[]>(saved.queue);
  const [index, setIndex] = useState(saved.queue[saved.index] ? saved.index : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [shuffle, setShuffle] = useState(saved.shuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(saved.repeat);
  const [volume, setVolumeState] = useState(saved.volume);
  const [videoMode, setVideoMode] = useState(false);
  const [slot, setVideoSlot] = useState<HTMLElement | null>(null);
  const [sourceLabel, setSourceLabel] = useState(saved.label);

  const current = queue[index] ?? null;

  const live = useRef({ queue, index, shuffle, repeat, volume, current });
  live.current = { queue, index, shuffle, repeat, volume, current };

  const hostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errorStreak = useRef(0);
  const historyRef = useRef<number[]>([]);
  const everPlayed = useRef(false);
  const ladderRef = useRef<((code: number) => boolean) | null>(null);
  const diag = useRef({ mode: "starting" as Diagnostics["mode"], attempt: "-", reason: "" });
  const handlers = useRef<{ ended: () => void; error: (code: number) => void }>({
    ended: () => {},
    error: () => {},
  });

  /* ---- silent audio (background keep-alive) ---- */

  const syncAudio = useCallback((playing: boolean) => {
    if (!("mediaSession" in navigator)) return;
    if (!audioRef.current) {
      const audio = document.createElement("audio");
      audio.src = createSilentWavUrl();
      audio.loop = true;
      audio.volume = 0;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("aria-hidden", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (playing) void audio.play().catch(() => {});
    else audio.pause();
  }, []);

  /* ---- the engine ---- */

  const engineRef = useRef<PlaybackEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new PlaybackEngine({
      onEnded: () => handlers.current.ended(),
      onTime: (t, d) => {
        setTime({ t, d });
        if ("mediaSession" in navigator && d > 0 && t <= d && Math.floor(t) % 5 === 0) {
          try {
            navigator.mediaSession.setPositionState({ duration: d, position: t, playbackRate: 1 });
          } catch {
            /* unsupported */
          }
        }
      },
      onPlaying: playing => {
        setIsPlaying(playing);
        if (playing) everPlayed.current = true;
        syncAudio(playing);
      },
      onBuffering: setBuffering,
      onError: code => {
        if (ladderRef.current?.(code)) return;
        handlers.current.error(code);
      },
    });
    engineRef.current.volume = saved.volume;
  }
  const engine = engineRef.current;

  /* ---- navigation ---- */

  const startAt = useCallback(
    (nextQueue: Track[], nextIndex_: number, label?: string, pushHistory = true) => {
      const track = nextQueue[nextIndex_];
      if (!track) return;
      live.current = { ...live.current, queue: nextQueue, index: nextIndex_, current: track };
      setQueue(nextQueue);
      setIndex(nextIndex_);
      if (label !== undefined) setSourceLabel(label);
      if (pushHistory) historyRef.current = [...historyRef.current.slice(-50), nextIndex_];
      pushRecent(track);
      syncAudio(true); // inside the user's gesture when started from a tap
      engine.load(track.id, parseDuration(track.duration));
    },
    [engine, pushRecent, syncAudio]
  );

  const pickNext = useCallback((auto: boolean) => {
    const { queue: q, index: i, shuffle: sh, repeat: rp } = live.current;
    return nextIndex({ length: q.length, index: i, shuffle: sh, repeat: rp, auto });
  }, []);

  const next = useCallback(() => {
    errorStreak.current = 0;
    const n = pickNext(false);
    if (n !== null) startAt(live.current.queue, n);
  }, [pickNext, startAt]);

  const prev = useCallback(() => {
    const { queue: q, index: i, shuffle: sh } = live.current;
    if (!q.length) return;
    errorStreak.current = 0;
    if (engine.position() > 3) {
      engine.seek(0);
      return;
    }
    let target = prevIndex(q.length, i);
    if (sh) {
      const h = historyRef.current;
      h.pop();
      const back = h.pop();
      if (back !== undefined && q[back]) target = back;
    }
    startAt(q, target);
  }, [engine, startAt]);

  handlers.current.ended = () => {
    if (live.current.repeat === "one") {
      engine.seek(0);
      engine.play();
      return;
    }
    const n = pickNext(true);
    if (n === null) {
      setIsPlaying(false);
      syncAudio(false);
      return;
    }
    startAt(live.current.queue, n);
  };

  handlers.current.error = (code: number) => {
    errorStreak.current += 1;
    toast(code === 100 || code === 101 || code === 150 ? "الأغنية دي مش متاحة للتشغيل هنا" : "حصلت مشكلة في تشغيل الأغنية");
    if (errorStreak.current >= Math.min(live.current.queue.length, 5)) {
      errorStreak.current = 0;
      engine.pause();
      return;
    }
    const n = pickNext(true);
    if (n === null) engine.pause();
    else startAt(live.current.queue, n);
  };

  /* ---- create the player (with fallbacks) ---- */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const timers: number[] = [];
    let destroyer: (() => void) | null = null;

    const clearHost = () => {
      destroyer?.();
      destroyer = null;
      while (host.firstChild) host.removeChild(host.firstChild);
    };

    const useEmbed = (reason: string) => {
      if (cancelled) return;
      clearHost();
      const embed = new EmbedPlayer(host, () => engine.position());
      destroyer = () => embed.destroy();
      diag.current = { mode: "embed", attempt: "embed", reason };
      engine.attach(embed);
    };

    const attemptApi = (attempt: number) => {
      loadYouTubeApi()
        .then(YT => {
          if (cancelled) return;
          clearHost();
          const cfg = ATTEMPTS[attempt];
          diag.current = { mode: "api", attempt: cfg.name, reason: "" };
          const mount = document.createElement("div");
          host.appendChild(mount);
          let settled = false;
          const fail = (reason: string) => {
            if (cancelled) return;
            if (attempt + 1 < ATTEMPTS.length) attemptApi(attempt + 1);
            else useEmbed(reason);
          };
          ladderRef.current = code => {
            // 153 = "player configuration error" (bad referrer/origin): try the next variant.
            if (code === 153 && !everPlayed.current && attempt + 1 <= ATTEMPTS.length) {
              fail("error-153");
              return true;
            }
            return false;
          };
          const player = new YT.Player(mount, {
            ...(cfg.host ? { host: cfg.host } : {}),
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: 0,
              controls: 0,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              ...(cfg.origin ? { origin: window.location.origin } : {}),
            },
            events: {
              onReady: () => {
                settled = true;
                engine.ready();
              },
              onStateChange: ({ data }) => {
                settled = true;
                engine.onState(data);
              },
              onError: ({ data }) => engine.onError(data),
            },
          });
          destroyer = () => {
            try {
              player.destroy();
            } catch {
              /* already gone */
            }
          };
          engine.attach(player);
          timers.push(
            window.setTimeout(() => {
              if (cancelled || settled || engine.hasMethods()) return;
              fail("no-ready");
            }, (window as unknown as { __ymusicWatchdogMs?: number }).__ymusicWatchdogMs ?? 8000)
          );
        })
        .catch(() => useEmbed("api-load-failed"));
    };

    attemptApi(0);
    const tick = window.setInterval(() => engine.tick(), 250);
    const onVisible = () => engine.tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      timers.forEach(id => window.clearTimeout(id));
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      clearHost();
      engine.attach(null);
    };
  }, [engine]);

  /* ---- public actions ---- */

  const toggle = useCallback(() => {
    const track = live.current.current;
    if (!track) return;
    if (engine.playing) {
      engine.pause();
      syncAudio(false);
      return;
    }
    syncAudio(true);
    if (!engine.isLoaded(track.id)) engine.load(track.id, parseDuration(track.duration));
    else engine.play();
  }, [engine, syncAudio]);

  const playTrack = useCallback(
    (track: Track, list?: Track[], label?: string) => {
      errorStreak.current = 0;
      const base = list && list.some(t => t.id === track.id) ? list : [track];
      startAt(base, base.findIndex(t => t.id === track.id), label ?? "");
    },
    [startAt]
  );

  const playList = useCallback(
    (tracks: Track[], opts: { shuffle?: boolean; label?: string } = {}) => {
      if (!tracks.length) return;
      errorStreak.current = 0;
      if (opts.shuffle !== undefined) setShuffle(opts.shuffle);
      live.current.shuffle = opts.shuffle ?? live.current.shuffle;
      const start = live.current.shuffle ? Math.floor(Math.random() * tracks.length) : 0;
      startAt(tracks, start, opts.label ?? "");
    },
    [startAt]
  );

  const seek = useCallback((seconds: number) => engine.seek(seconds), [engine]);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(v)));
      setVolumeState(clamped);
      engine.setVolume(clamped);
    },
    [engine]
  );

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat(r => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    []
  );

  const playNext = useCallback(
    (track: Track) => {
      const { queue: q, index: i, current: c } = live.current;
      if (!c) {
        startAt([track], 0, "");
        return;
      }
      const without = q.filter((t, n) => t.id !== track.id || n === i);
      const at = without.findIndex(t => t.id === c.id) + 1;
      const nextQueue = [...without.slice(0, at), track, ...without.slice(at)];
      setQueue(nextQueue);
      setIndex(nextQueue.findIndex(t => t.id === c.id));
      toast("هيتشغّل بعد الأغنية الحالية");
    },
    [startAt]
  );

  const addToQueue = useCallback(
    (track: Track) => {
      const { queue: q, current: c } = live.current;
      if (!c) {
        startAt([track], 0, "");
        return;
      }
      if (q.some(t => t.id === track.id)) {
        toast("الأغنية موجودة في قائمة الانتظار");
        return;
      }
      setQueue([...q, track]);
      toast("اتضافت لقائمة الانتظار");
    },
    [startAt]
  );

  const removeFromQueue = useCallback((i: number) => {
    const { queue: q, index: cur } = live.current;
    if (i === cur || i < 0 || i >= q.length) return;
    setQueue(q.filter((_, n) => n !== i));
    if (i < cur) setIndex(cur - 1);
  }, []);

  const jumpTo = useCallback(
    (i: number) => {
      const q = live.current.queue;
      errorStreak.current = 0;
      if (q[i]) startAt(q, i);
    },
    [startAt]
  );

  const getDiagnostics = useCallback(
    (): Diagnostics => ({
      ...diag.current,
      apiLoaded: Boolean(window.YT?.Player),
      methods: engine.hasMethods(),
      eventsAlive: engine.eventsAlive,
      lastState: engine.lastState,
      lastError: engine.lastError,
      position: Math.round(engine.position() * 10) / 10,
      origin: window.location.origin,
      native: isNativeApp(),
    }),
    [engine]
  );

  /* ---- persistence, title, video slot, media session ---- */

  useEffect(() => {
    engine.setVolume(volume);
  }, [engine, volume]);

  useEffect(() => {
    writeJson(STORE_KEY, {
      queue: queue.slice(0, 150),
      index: index < 150 ? index : 0,
      volume,
      shuffle,
      repeat,
      label: sourceLabel,
    } satisfies Saved);
  }, [queue, index, volume, shuffle, repeat, sourceLabel]);

  useEffect(() => {
    document.title = current ? `${isPlaying ? "▶ " : ""}${current.title} • YMusic` : "YMusic";
  }, [current, isPlaying]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!videoMode || !slot) {
      host.className = "yt-host";
      host.removeAttribute("style");
      return;
    }
    host.className = "yt-host shown";
    let frame = 0;
    const sync = () => {
      const r = slot.getBoundingClientRect();
      host.style.left = `${r.left}px`;
      host.style.top = `${r.top}px`;
      host.style.width = `${r.width}px`;
      host.style.height = `${r.height}px`;
      frame = requestAnimationFrame(sync);
    };
    sync();
    return () => cancelAnimationFrame(frame);
  }, [videoMode, slot]);

  const actions = useRef({ toggle, next, prev, seek });
  actions.current = { toggle, next, prev, seek };

  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.channel,
      album: "YMusic",
      artwork: [{ src: current.thumbnail, sizes: "480x360", type: "image/jpeg" }],
    });
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    };
    set("play", () => actions.current.toggle());
    set("pause", () => actions.current.toggle());
    set("nexttrack", () => actions.current.next());
    set("previoustrack", () => actions.current.prev());
    set("seekto", d => {
      if (typeof d.seekTime === "number") actions.current.seek(d.seekTime);
    });
    set("seekbackward", () => actions.current.seek(Math.max(0, timeState.t - 10)));
    set("seekforward", () => actions.current.seek(timeState.t + 10));
    return () => {
      for (const a of ["play", "pause", "nexttrack", "previoustrack", "seekto", "seekbackward", "seekforward"] as MediaSessionAction[]) {
        set(a, null);
      }
    };
  }, []);

  // Space toggles playback on desktop (ignored while typing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (event.code !== "Space" || !el) return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.isContentEditable) return;
      event.preventDefault();
      actions.current.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<PlayerApi>(
    () => ({
      current,
      queue,
      index,
      isPlaying,
      buffering,
      shuffle,
      repeat,
      volume,
      videoMode,
      sourceLabel,
      playTrack,
      playList,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      removeFromQueue,
      jumpTo,
      setVideoMode,
      setVideoSlot,
      getDiagnostics,
    }),
    [
      current,
      queue,
      index,
      isPlaying,
      buffering,
      shuffle,
      repeat,
      volume,
      videoMode,
      sourceLabel,
      playTrack,
      playList,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      removeFromQueue,
      jumpTo,
      getDiagnostics,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div ref={hostRef} className="yt-host" />
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PlayerProvider missing");
  return ctx;
}
