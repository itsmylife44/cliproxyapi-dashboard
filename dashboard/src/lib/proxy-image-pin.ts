import { open } from "fs/promises";

// Docker tag grammar. Also keeps the .env line free of newlines, quotes, `$` and `#`.
export const DOCKER_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

/**
 * The CLIProxyAPI version is pinned by CLIPROXYAPI_IMAGE_TAG in the host's
 * infrastructure/.env, which compose reads on every `up`. The production
 * compose file bind-mounts that file (and only that file) writable here.
 */
export function hostEnvFilePath(): string {
  return process.env.CLIPROXYAPI_HOST_ENV_FILE || "/opt/cliproxyapi/host.env";
}

const IMAGE_TAG_LINE = /^CLIPROXYAPI_IMAGE_TAG=.*$/m;

/** Sets CLIPROXYAPI_IMAGE_TAG, leaving every other byte of the file unchanged. */
export function withImageTag(content: string, tag: string): string {
  if (!DOCKER_TAG_PATTERN.test(tag)) {
    throw new Error(`Invalid image tag: ${JSON.stringify(tag)}`);
  }
  const line = `CLIPROXYAPI_IMAGE_TAG=${tag}`;
  if (IMAGE_TAG_LINE.test(content)) {
    return content.replace(new RegExp(IMAGE_TAG_LINE.source, "gm"), line);
  }
  const separator = content === "" || content.endsWith("\n") ? "" : "\n";
  return `${content}${separator}${line}\n`;
}

// Opens the file instead of calling access(): through some bind mounts
// (Docker Desktop) access(W_OK) reports writable while open() fails.
export async function isWritableFile(filePath: string): Promise<boolean> {
  try {
    const file = await open(filePath, "r+");
    try {
      return (await file.stat()).isFile();
    } finally {
      await file.close();
    }
  } catch {
    return false;
  }
}

/**
 * Overwrites the file in place. A rename would swap the inode and the host
 * would never see the change through a single-file bind mount.
 */
export async function writeInPlace(filePath: string, content: string): Promise<void> {
  const data = Buffer.from(content);
  const file = await open(filePath, "r+");
  try {
    await file.write(data, 0, data.length, 0);
    await file.truncate(data.length);
    await file.sync();
  } finally {
    await file.close();
  }
}
