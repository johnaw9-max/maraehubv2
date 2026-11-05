// Test stub for supabase-js createClient(): an in-memory fake controlled by tests.
export function createClient(_url: string, _key: string, _opts?: unknown) {
  return (globalThis as any).__fakeSupabase();
}
