// Which environment this build talks to. Set at build time by the Vite mode:
//   pnpm dev               -> development (local, uses .env / .env.local)
//   pnpm build:staging     -> staging     (staging Supabase project)
//   pnpm build:production  -> production  (production Supabase project)
// There is deliberately no runtime switch: a shipped build can only ever reach its own backend.
export type AppEnv = "development" | "staging" | "production";

export const APP_ENV: AppEnv =
  import.meta.env.MODE === "production" ? "production" : import.meta.env.MODE === "staging" ? "staging" : "development";

export const isProduction = APP_ENV === "production";

function required(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`${name} is not set for the "${APP_ENV}" build. See .env.example.`);
  }
  return value;
}

export const SUPABASE_URL = required("VITE_SUPABASE_URL");
export const SUPABASE_PUBLISHABLE_KEY = required("VITE_SUPABASE_PUBLISHABLE_KEY");
