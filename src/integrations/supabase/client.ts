import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const PROD_URL = import.meta.env.VITE_SUPABASE_URL || "https://yovtootzxrgfqkllqyxp.supabase.co";
const PROD_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRvb3R6eHJnZnFrbGxxeXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzE4NTYsImV4cCI6MjA4NzEwNzg1Nn0.VNpjJqObFGxxiZorE7kB8Vc6fLSfzcMfvE2a9U_jtnQ";

export const ENV_KEY = "nutricoach_env";
export type AppEnv = "prod" | "qa";

export function getActiveEnv(): AppEnv {
  return (localStorage.getItem(ENV_KEY) as AppEnv) || "prod";
}

export function getEnvConfig(env: AppEnv) {
  if (env === "qa") {
    return {
      url: localStorage.getItem("nutricoach_qa_url") || "",
      key: localStorage.getItem("nutricoach_qa_key") || "",
    };
  }
  return { url: PROD_URL, key: PROD_KEY };
}

const env = getActiveEnv();
const { url, key } = getEnvConfig(env);

export const supabase = createClient<Database>(url || PROD_URL, key || PROD_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
