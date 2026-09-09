declare module "@supabase/supabase-js" {
  export type User = { id: string; email?: string; role?: string };
  type Query = {
    select(columns?: string): Query; eq(column: string, value: unknown): Query; order(column: string, options?: { ascending?: boolean }): Query; limit(count: number): Query; insert(value: unknown): Query; update(value: unknown): Query; delete(): Query; single(): Promise<{ data: unknown | null; error: { message: string } | null }>; maybeSingle(): Promise<{ data: unknown | null; error: { message: string } | null }>;
    then<TResult1 = { data: unknown | null; error: { message: string } | null }, TResult2 = never>(onfulfilled?: ((value: { data: unknown | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2>;
  };
  export type SupabaseClient = { auth: { getUser(token: string): Promise<{ data: { user: User | null }; error: { message: string } | null }> }; from(table: string): Query };
  export function createClient(url: string, key: string, options?: unknown): SupabaseClient;
}
