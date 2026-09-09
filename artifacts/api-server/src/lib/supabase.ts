import type { SupabaseClient, User } from "@supabase/supabase-js";

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
};

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

const loadCreateClient = async () => {
  const mod = await import(/* @vite-ignore */ "@supabase/supabase-js");
  return mod.createClient;
};

export const getSupabaseAdmin = async (): Promise<SupabaseClient> => {
  if (!adminClient) {
    const createClient = await loadCreateClient();
    adminClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient;
};

export const getSupabaseAuthClient = async (): Promise<SupabaseClient> => {
  if (!authClient) {
    const createClient = await loadCreateClient();
    authClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return authClient;
};

export type AuthUser = Pick<User, "id" | "email" | "role">;
