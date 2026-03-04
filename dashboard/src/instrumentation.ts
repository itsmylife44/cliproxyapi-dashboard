/**
 * Next.js Instrumentation entrypoint — works in both Node.js and Edge runtimes.
 *
 * Node.js-specific logic (quota alert scheduler) is isolated in
 * instrumentation-node.ts and conditionally imported to avoid
 * Edge Runtime warnings about node:fs, node:path, etc.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import(
      "./instrumentation-node"
    );
    registerNodeInstrumentation();
  }
}
