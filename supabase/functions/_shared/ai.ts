// Calls Google Gemini directly through its OpenAI-compatible endpoint. This replaces the
// Lovable AI gateway (ai.gateway.lovable.dev + LOVABLE_API_KEY), which only works inside
// Lovable Cloud. Request and response shapes are the same chat-completions format.
//
// Secrets (set per Supabase project, staging and production separately):
//   GEMINI_API_KEY        required, from Google AI Studio
//   GEMINI_MODEL_TEXT     optional override, defaults below
//   GEMINI_MODEL_VISION   optional override, defaults below
export const AI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// gemini-2.5-* is closed to API keys created after mid-2026 (404 "no longer available to new users").
export const AI_MODEL_TEXT = Deno.env.get("GEMINI_MODEL_TEXT") ?? "gemini-3.8-flash";
export const AI_MODEL_VISION = Deno.env.get("GEMINI_MODEL_VISION") ?? "gemini-3.8-flash";

export function requireAiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  return key;
}
