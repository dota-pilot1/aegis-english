import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const defaultApiUrl =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3301" : "https://dxline-tallent.com");

export async function apiFetch(input: string, init?: RequestInit) {
  return tauriFetch(input, init);
}
