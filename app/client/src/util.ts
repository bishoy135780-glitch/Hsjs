import type { Track } from "./types";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = Math.floor(value % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function parseDuration(value?: string) {
  if (!value || !/^\d+(?::\d{2}){1,2}$/.test(value)) return 0;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

export function totalMinutes(tracks: Track[]) {
  return Math.round(tracks.reduce((sum, t) => sum + parseDuration(t.duration), 0) / 60);
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function arNum(n: number) {
  return String(n).replace(/\d/g, d => ARABIC_DIGITS[Number(d)]);
}

/** Stable pleasant colour from a string (used for gradients). */
export function colorFor(seed: string, sat = 55, light = 32) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360} ${sat}% ${light}%)`;
}

/** Cleans typical YouTube noise out of titles: "(Official Video)", "[Lyrics]" ... */
export function cleanTitle(title: string) {
  return title
    .replace(/[([](official|lyrics?|lyric video|audio|video|music video|كلمات|فيديو كليب|الكليب الرسمي)[^)\]]*[)\]]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) */
  }
}

export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
