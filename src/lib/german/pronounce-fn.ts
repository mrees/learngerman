import { createServerFn } from "@tanstack/react-start";

type PronounceResult =
  | { ok: true; audioBase64: string }
  | { ok: false; error: "unavailable" | "empty" | "failed" };

const cache = new Map<string, string>();
const CACHE_MAX = 80;

function remember(text: string, audioBase64: string) {
  if (cache.has(text)) cache.delete(text);
  cache.set(text, audioBase64);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x1000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export const pronounceGerman = createServerFn({ method: "POST" })
  .validator((input: { text?: string }) => ({
    text: typeof input?.text === "string" ? input.text.trim().slice(0, 120) : "",
  }))
  .handler(async ({ data }): Promise<PronounceResult> => {
    if (!data.text) return { ok: false, error: "empty" };
    const hit = cache.get(data.text);
    if (hit) {
      remember(data.text, hit);
      return { ok: true, audioBase64: hit };
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };
    try {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text: data.text,
          voice_id: "ara",
          language: "de",
        }),
      });
      if (!res.ok) return { ok: false, error: "failed" };
      const audioBase64 = toBase64(new Uint8Array(await res.arrayBuffer()));
      if (!audioBase64) return { ok: false, error: "failed" };
      remember(data.text, audioBase64);
      return { ok: true, audioBase64 };
    } catch {
      return { ok: false, error: "failed" };
    }
  });
