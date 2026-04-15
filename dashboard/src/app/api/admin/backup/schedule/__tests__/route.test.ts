import { describe, it, expect } from "vitest";

/**
 * Cron expression validation function
 * Extracted from route.ts for testing
 * Format: minute hour day month weekday
 */
function isValidCronExpression(expr: string): boolean {
  // Basic cron format: 5 space-separated fields
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  // Each field should be: number, *, or valid range/list
  const fieldPattern = /^(\*|(\d+|\*)(-\d+)?(\/\d+)?(,(\d+|\*)(-\d+)?(\/\d+)?)*|\d+)$/;
  return parts.every((part) => fieldPattern.test(part));
}

describe("isValidCronExpression", () => {
  describe("valid cron expressions", () => {
    it("should accept standard daily at 3am", () => {
      expect(isValidCronExpression("0 3 * * *")).toBe(true);
    });

    it("should accept every 5 minutes", () => {
      expect(isValidCronExpression("*/5 * * * *")).toBe(true);
    });

    it("should accept first of month at midnight", () => {
      expect(isValidCronExpression("0 0 1 * *")).toBe(true);
    });

    it("should accept ranges and lists combined", () => {
      expect(isValidCronExpression("30 4 1,15 * 0-6")).toBe(true);
    });

    it("should accept specific weekday", () => {
      expect(isValidCronExpression("0 0 * * 0")).toBe(true);
    });

    it("should accept specific minute and hour", () => {
      expect(isValidCronExpression("15 14 1 * *")).toBe(true);
    });

    it("should accept step values with asterisk", () => {
      expect(isValidCronExpression("0 */2 * * *")).toBe(true);
    });

    it("should accept all asterisks (every minute)", () => {
      expect(isValidCronExpression("* * * * *")).toBe(true);
    });

    it("should accept multiple comma-separated values", () => {
      expect(isValidCronExpression("0,15,30,45 * * * *")).toBe(true);
    });

    it("should accept expressions with multiple spaces between fields", () => {
      expect(isValidCronExpression("0  3  *  *  *")).toBe(true);
    });

    it("should accept expressions with leading/trailing spaces", () => {
      expect(isValidCronExpression("  0 3 * * *  ")).toBe(true);
    });

    it("should accept complex expressions", () => {
      expect(isValidCronExpression("0 0,12 1,15 1-6 0-5")).toBe(true);
    });
  });

  describe("invalid cron expressions", () => {
    it("should reject non-cron string", () => {
      expect(isValidCronExpression("invalid")).toBe(false);
    });

    it("should reject only 4 fields", () => {
      expect(isValidCronExpression("0 3 * *")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidCronExpression("")).toBe(false);
    });

    it("should reject 6 fields", () => {
      expect(isValidCronExpression("0 3 * * * *")).toBe(false);
    });

    it("should reject only whitespace", () => {
      expect(isValidCronExpression("   ")).toBe(false);
    });

    it("should reject 1 field", () => {
      expect(isValidCronExpression("*")).toBe(false);
    });

    it("should reject 2 fields", () => {
      expect(isValidCronExpression("0 3")).toBe(false);
    });

    it("should reject 3 fields", () => {
      expect(isValidCronExpression("0 3 *")).toBe(false);
    });

    it("should reject text in fields", () => {
      expect(isValidCronExpression("0 three * * *")).toBe(false);
    });

    it("should reject special characters not allowed", () => {
      expect(isValidCronExpression("0 3 ? * *")).toBe(false);
    });

    it("should reject hash syntax (not standard cron)", () => {
      expect(isValidCronExpression("0 3 * * 1#1")).toBe(false);
    });

    it("should reject L syntax (not standard cron)", () => {
      expect(isValidCronExpression("0 3 L * *")).toBe(false);
    });

    it("should reject W syntax (not standard cron)", () => {
      expect(isValidCronExpression("0 3 15W * *")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle tabs between fields", () => {
      expect(isValidCronExpression("0\t3\t*\t*\t*")).toBe(true);
    });

    it("should handle mixed tabs and spaces", () => {
      expect(isValidCronExpression("0 \t3 * * *")).toBe(true);
    });

    it("should accept large but valid numbers", () => {
      // While semantically invalid (59 is max minute), syntax is valid
      expect(isValidCronExpression("99 99 99 99 99")).toBe(true);
    });

    it("should accept zero-padded numbers", () => {
      expect(isValidCronExpression("00 03 01 01 00")).toBe(true);
    });

    it("should accept single digit values", () => {
      expect(isValidCronExpression("0 3 1 1 0")).toBe(true);
    });
  });
});
