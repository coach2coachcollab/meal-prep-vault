// Stub — lovable OAuth is replaced by standard Supabase OAuth in AuthPage.tsx
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: unknown) => ({ error: null }),
  },
};
