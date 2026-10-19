/**
 * Where the API lives.
 *  - In the browser (dev server / Vercel / Docker) it is the same origin → "".
 *  - Inside the Android (Capacitor) app the page is served from https://localhost,
 *    so the API must be your deployed server. Change this URL if you redeploy elsewhere.
 */
export const PUBLIC_API_BASE_URL = "https://youtube-music-playe.vercel.app";

type CapacitorLike = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export function isNativeApp(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const platform = cap?.getPlatform?.();
    return platform === "android" || platform === "ios";
  } catch {
    return false;
  }
}

// Search must never fall back to the Capacitor WebView origin. The APK has no
// local /api server, so using the deployed API unconditionally avoids the
// native-platform detection differences between Capacitor versions.
export const API_BASE = PUBLIC_API_BASE_URL.replace(/\/$/, "");
