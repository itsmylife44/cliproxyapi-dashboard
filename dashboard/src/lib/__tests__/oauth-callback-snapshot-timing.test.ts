import { describe, expect, it } from "vitest";

/**
 * Reproduction test for the preCallbackFiles snapshot timing bug.
 *
 * For non-callback providers (Cursor, CodeBuddy), the OAuth flow is:
 *   1. Client fetches auth URL
 *   2. User completes auth in browser → CLIProxyAPI writes the auth file
 *   3. Client calls POST /oauth-callback
 *
 * The snapshot is taken at the start of step 3, AFTER the file is written.
 * So findNewAuthFilesByDiff returns 0 candidates, and since Cursor filenames
 * don't embed state, state-match also fails.
 * findUnclaimedAuthFiles only fires at attempt >= MAX_RETRIES - 2 (attempt 8),
 * causing a 10.5-second unnecessary delay.
 *
 * Additionally, the `preCallbackNames` set used in the "unclaimed-new" branch
 * includes the newly-written file (since it was taken after auth completed),
 * so if there are multiple unclaimed Cursor files, the new one is filtered OUT
 * of `newAndUnclaimed`, causing the claim to fail entirely.
 */
describe("preCallbackFiles snapshot timing bug (non-callback providers)", () => {
  it("confirms: if file is already present when snapshot is taken, diff finds no new files", () => {
    // Simulate snapshot taken AFTER the cursor auth file was written
    const preSnapshot = [
      { name: "cursor-abc123.json", provider: "cursor" },
    ];
    const afterFiles = [
      { name: "cursor-abc123.json", provider: "cursor" },  // same file
    ];

    const beforeNames = new Set(preSnapshot.map((f) => f.name));
    const newFiles = afterFiles.filter((f) => !beforeNames.has(f.name));

    // Bug: diff finds no new files even though cursor-abc123.json IS the one we want
    expect(newFiles).toHaveLength(0);
  });

  it("confirms: preCallbackNames includes the new file when snapshot is taken too late", () => {
    // Pre-snapshot includes the newly-written file (taken after auth is done)
    const preCallbackNames = new Set([
      "cursor-old.json",
      "cursor-new.json", // <-- this is the file we JUST wrote during auth
    ]);

    // Unclaimed candidates for this provider
    const unclaimedCandidates = [
      { name: "cursor-old.json", provider: "cursor" },  // old, owned by someone else? No — unclaimed
      { name: "cursor-new.json", provider: "cursor" },  // the one we just authed
    ];

    // The "unclaimed-new" branch tries to find files NOT in preCallbackNames
    const newAndUnclaimed = unclaimedCandidates.filter(
      (f) => !preCallbackNames.has(f.name)
    );

    // Bug: both files are in preCallbackNames (snapshot was too late),
    // so newAndUnclaimed is empty — claim FAILS for multi-account scenario
    expect(newAndUnclaimed).toHaveLength(0);
  });
});
