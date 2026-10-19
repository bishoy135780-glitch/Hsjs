import type { RepeatMode } from "./types";

/**
 * Pure queue navigation — no React, no player. Returns the index to play next,
 * or null when the queue has naturally finished (auto-advance with repeat off).
 */
export function nextIndex(opts: {
  length: number;
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** true when a track ended by itself, false when the user pressed "next". */
  auto: boolean;
  random?: () => number;
}): number | null {
  const { length, index, shuffle, repeat, auto, random = Math.random } = opts;
  if (length <= 0) return null;
  if (shuffle && length > 1) {
    let n = Math.floor(random() * length);
    if (n === index) n = (n + 1) % length;
    return n;
  }
  if (index + 1 < length) return index + 1;
  if (!auto || repeat === "all") return 0; // wrap around
  return null;
}

export function prevIndex(length: number, index: number): number {
  if (length <= 0) return -1;
  return index - 1 < 0 ? length - 1 : index - 1;
}
