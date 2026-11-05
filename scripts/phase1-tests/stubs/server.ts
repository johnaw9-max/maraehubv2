// Test stub for std/http serve(): captures the handler instead of listening.
export function serve(handler: (req: Request) => Promise<Response> | Response) {
  (globalThis as any).__handlers ??= [];
  (globalThis as any).__handlers.push(handler);
}
