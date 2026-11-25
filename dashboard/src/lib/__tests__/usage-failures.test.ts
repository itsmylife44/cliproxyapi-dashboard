import { describe, expect, it } from "vitest";
import {
  extractFailureDetails,
  isCancelledFailure,
  MAX_FAILURE_BODY_LENGTH,
  MAX_FAILURE_CODE_LENGTH,
} from "../usage-failures";

describe("extractFailureDetails", () => {
  it("returns null fields when the request did not fail", () => {
    expect(
      extractFailureDetails({
        failed: false,
        fail: { status_code: 500, code: "err", body: "ignored" },
      }),
    ).toEqual({
      failureStatus: null,
      failureCode: null,
      failureBody: null,
    });
  });

  it("strips NUL and ASCII control characters while preserving tabs and newlines", () => {
    const result = extractFailureDetails({
      failed: true,
      fail: {
        status_code: 502,
        code: "bad\x00_gate\x07way\x7f",
        body: "line1\x00\x01\x08\n\tline2\r\nend\x1b[31m",
      },
    });

    expect(result.failureStatus).toBe(502);
    expect(result.failureCode).toBe("bad_gateway");
    expect(result.failureBody).toBe("line1\n\tline2\r\nend[31m");
  });

  it("redacts Bearer tokens, API keys, and email addresses in failureBody", () => {
    const result = extractFailureDetails({
      failed: true,
      fail: {
        status_code: 401,
        code: "unauthorized",
        body: [
          "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
          "openai=sk-proj-abc1234567890",
          "google=AIzaSyDummyKey1234567890",
          "github=ghp_1234567890abcdef",
          "slack=xoxb-1234567890-abcdef",
          "user=alice.smith@example.com",
        ].join(" "),
      },
    });

    expect(result.failureBody).toBe(
      "Authorization: Bearer [REDACTED] openai=[REDACTED] google=[REDACTED] github=[REDACTED] slack=[REDACTED] user=[REDACTED]",
    );
  });

  it("caps failureBody at 500 characters and failureCode at 128 characters", () => {
    const result = extractFailureDetails({
      failed: true,
      fail: {
        status_code: 500,
        code: "c".repeat(200),
        body: "b".repeat(800),
      },
    });

    expect(result.failureCode).toHaveLength(MAX_FAILURE_CODE_LENGTH);
    expect(result.failureBody).toHaveLength(MAX_FAILURE_BODY_LENGTH);
  });
});

describe("isCancelledFailure", () => {
  it("returns false when failed is false", () => {
    expect(isCancelledFailure(false, 499, "canceled", "context canceled")).toBe(false);
  });

  it("detects HTTP 499, canceled code, and context canceled body", () => {
    expect(isCancelledFailure(true, 499, null, null)).toBe(true);
    expect(isCancelledFailure(true, 500, "canceled", null)).toBe(true);
    expect(isCancelledFailure(true, 502, null, "Upstream error: Context Canceled by peer")).toBe(true);
  });

  it("returns false for non-cancellation failures", () => {
    expect(isCancelledFailure(true, 500, "internal_error", "upstream timeout")).toBe(false);
  });
});
