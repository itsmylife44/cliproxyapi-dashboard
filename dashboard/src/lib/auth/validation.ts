import "server-only";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
