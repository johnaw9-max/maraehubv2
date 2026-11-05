// Test stub for the Anthropic SDK: records calls, returns a canned draft.
export default class Anthropic {
  messages = {
    create: async (args: unknown) => {
      (globalThis as any).__aiCalls ??= [];
      (globalThis as any).__aiCalls.push(args);
      return { content: [{ type: 'text', text: JSON.stringify({ minutes: 'Draft', resolutions: [], actions: [] }) }] };
    },
  };
  constructor(_opts: unknown) {}
}
