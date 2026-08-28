declare module "@supabase/supabase-js" {
  export function createClient(url: string, key: string, options?: unknown): {
    auth: {
      getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
      onAuthStateChange(callback: (event: string, session: { access_token: string } | null) => void): { data: { subscription: { unsubscribe(): void } } };
      signInWithPassword(input: { email: string; password: string }): Promise<{ error: { message?: string } | null }>;
      signOut(): Promise<{ error: { message?: string } | null }>;
    };
  };
}
