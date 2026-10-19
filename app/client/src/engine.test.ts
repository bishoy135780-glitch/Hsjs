import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlaybackEngine, type PlayerLike } from "./engine.js";
import { nextIndex, prevIndex } from "./queue.js";

function setup(player: PlayerLike | null = null) {
  let clock = 0;
  const log = { ended: 0, playing: [] as boolean[], times: [] as number[], calls: [] as string[] };
  const engine = new PlaybackEngine(
    {
      onEnded: () => (log.ended += 1),
      onTime: t => log.times.push(t),
      onPlaying: p => log.playing.push(p),
      onBuffering: () => {},
    },
    () => clock
  );
  engine.attach(player);
  const advance = (seconds: number, step = 0.25) => {
    for (let s = 0; s < seconds; s += step) {
      clock += step * 1000;
      engine.tick();
    }
  };
  return { engine, log, advance, now: () => clock };
}

/** A player whose methods exist but never deliver data or events (the broken-WebView case). */
function silentPlayer(calls: string[]): PlayerLike {
  return {
    loadVideoById: id => void calls.push(`load:${id}`),
    playVideo: () => void calls.push("play"),
    pauseVideo: () => void calls.push("pause"),
    seekTo: s => void calls.push(`seek:${s}`),
    setVolume: () => {},
    getCurrentTime: () => 0,
    getDuration: () => 0,
  };
}

describe("PlaybackEngine without player events", () => {
  it("time advances on its own clock", () => {
    const calls: string[] = [];
    const { engine, advance, log } = setup(silentPlayer(calls));
    engine.load("AAAAAAAAAAA", 200);
    advance(10);
    assert.ok(Math.abs(engine.position() - 10) < 0.3, `position ${engine.position()}`);
    assert.ok(log.times.at(-1)! > 9);
    assert.deepEqual(calls.filter(c => String(c).startsWith("load")), ["load:AAAAAAAAAAA"]);
  });

  it("auto-advances exactly once when the known duration is reached", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 20);
    advance(19);
    assert.equal(log.ended, 0);
    advance(3);
    assert.equal(log.ended, 1);
    advance(10);
    assert.equal(log.ended, 1, "must not fire again");
  });

  it("next load after an end plays the next track and ends it again", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 10);
    advance(11);
    assert.equal(log.ended, 1);
    engine.load("BBBBBBBBBBB", 10);
    assert.equal(engine.position() < 1, true);
    advance(11);
    assert.equal(log.ended, 2);
  });

  it("pause freezes the clock, play resumes, seek jumps", () => {
    const { engine, advance } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 100);
    advance(5);
    engine.pause();
    const frozen = engine.position();
    advance(5);
    assert.equal(engine.position(), frozen);
    engine.play();
    advance(2);
    assert.ok(engine.position() > frozen + 1.5);
    engine.seek(60);
    advance(1);
    assert.ok(engine.position() >= 60 && engine.position() < 62);
  });

  it("does not end while paused", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 10);
    advance(4);
    engine.pause();
    advance(30);
    assert.equal(log.ended, 0);
  });

  it("unknown duration (live) never auto-ends", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 0);
    advance(600, 5);
    assert.equal(log.ended, 0);
  });
});

describe("PlaybackEngine command queueing", () => {
  it("queues a load until the player exposes its methods (no onReady needed)", () => {
    const calls: string[] = [];
    const { engine, advance } = setup({});
    engine.load("AAAAAAAAAAA", 100);
    advance(1);
    assert.equal(engine.isLoaded("AAAAAAAAAAA"), true);
    assert.deepEqual(calls, []);
    Object.assign(engine.player!, silentPlayer(calls)); // methods appear later
    advance(0.5);
    assert.deepEqual(calls.filter(c => String(c).startsWith("load")), ["load:AAAAAAAAAAA"]);
  });

  it("only the latest pending load wins when next is pressed repeatedly", () => {
    const calls: string[] = [];
    const { engine, advance } = setup({});
    engine.load("AAAAAAAAAAA", 100);
    engine.load("BBBBBBBBBBB", 100);
    engine.load("CCCCCCCCCCC", 100);
    Object.assign(engine.player!, silentPlayer(calls));
    advance(0.5);
    assert.deepEqual(calls.filter(c => String(c).startsWith("load")), ["load:CCCCCCCCCCC"]);
  });

  it("works with no player at all, then attaches", () => {
    const calls: string[] = [];
    const { engine, advance } = setup(null);
    engine.load("AAAAAAAAAAA", 100);
    advance(2);
    engine.attach(silentPlayer(calls));
    assert.deepEqual(calls.filter(c => String(c).startsWith("load")), ["load:AAAAAAAAAAA"]);
  });
});

describe("PlaybackEngine with a healthy player", () => {
  it("uses the player's time and its ended event", () => {
    let t = 0;
    const player: PlayerLike = { ...silentPlayer([]), getCurrentTime: () => t, getDuration: () => 100 };
    const { engine, advance, log } = setup(player);
    engine.load("AAAAAAAAAAA", 100);
    engine.onState(1);
    t = 40;
    advance(3);
    assert.ok(Math.abs(engine.position() - 40) < 0.5, `pos ${engine.position()}`);
    engine.onState(0);
    assert.equal(log.ended, 1);
    t = 100;
    advance(5);
    assert.equal(log.ended, 1, "time reaching the end must not double-fire");
  });

  it("ignores stale time from the previous track right after load", () => {
    let t = 180;
    const player: PlayerLike = { ...silentPlayer([]), getCurrentTime: () => t, getDuration: () => 200 };
    const { engine, advance, log } = setup(player);
    engine.load("AAAAAAAAAAA", 200);
    advance(1); // player still reports 180s of the old track
    assert.ok(engine.position() < 5, `stale time leaked: ${engine.position()}`);
    assert.equal(log.ended, 0);
  });

  it("ignores the transient PAUSED during load but honours a real pause", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 100);
    engine.onState(2);
    assert.equal(engine.playing, true);
    advance(3);
    engine.onState(2);
    assert.equal(engine.playing, false);
    assert.equal(log.playing.at(-1), false);
  });

  it("falls back to the clock if events stop but duration is known", () => {
    const { engine, advance, log } = setup(silentPlayer([]));
    engine.load("AAAAAAAAAAA", 30);
    engine.onState(1); // events alive, then silence
    advance(29);
    assert.equal(log.ended, 0, "waits for the player's own ended event first");
    advance(3);
    assert.equal(log.ended, 1, "…but still advances if it never comes");
  });
});

describe("queue navigation", () => {
  const base = { length: 3, shuffle: false, repeat: "off" as const };
  it("moves forward and wraps on manual next", () => {
    assert.equal(nextIndex({ ...base, index: 0, auto: false }), 1);
    assert.equal(nextIndex({ ...base, index: 2, auto: false }), 0);
  });
  it("auto-advance stops at the end unless repeat all", () => {
    assert.equal(nextIndex({ ...base, index: 2, auto: true }), null);
    assert.equal(nextIndex({ ...base, index: 2, auto: true, repeat: "all" }), 0);
    assert.equal(nextIndex({ ...base, index: 1, auto: true }), 2);
  });
  it("shuffle never repeats the current track", () => {
    assert.equal(nextIndex({ ...base, index: 1, auto: true, shuffle: true, random: () => 1 / 3 }), 2);
  });
  it("empty queue and prev wrap", () => {
    assert.equal(nextIndex({ ...base, length: 0, index: 0, auto: false }), null);
    assert.equal(prevIndex(3, 0), 2);
    assert.equal(prevIndex(3, 2), 1);
  });
});
