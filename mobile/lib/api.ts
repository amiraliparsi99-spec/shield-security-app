import Constants from "expo-constants";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Resolve API base URL for Expo Go/dev devices.
 * - Uses EXPO_PUBLIC_API_URL when it is a non-localhost URL.
 * - If EXPO_PUBLIC_API_URL is localhost, rewrites it to the LAN host from Expo metadata.
 */
export function getApiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || "").trim();

  if (configured && !isLocalhostUrl(configured)) {
    return trimTrailingSlash(configured);
  }

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    null;

  if (hostUri) {
    const host = String(hostUri).split(":")[0];
    if (host) {
      return `http://${host}:3000`;
    }
  }

  return trimTrailingSlash(configured || "http://localhost:3000");
}
