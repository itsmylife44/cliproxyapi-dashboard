import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { isWritableFile, withImageTag, writeInPlace } from "@/lib/proxy-image-pin";

describe("withImageTag", () => {
  it("replaces an existing CLIPROXYAPI_IMAGE_TAG line and leaves every other byte alone", () => {
    const env = "# stack\r\nTZ=UTC\r\nCLIPROXYAPI_IMAGE_TAG=v8.0.29\r\nJWT_SECRET=a=b#c\r\n";
    expect(withImageTag(env, "v8.0.28")).toBe(
      "# stack\r\nTZ=UTC\r\nCLIPROXYAPI_IMAGE_TAG=v8.0.28\r\nJWT_SECRET=a=b#c\r\n"
    );
  });

  it("appends the line when it is missing", () => {
    expect(withImageTag("TZ=UTC\n", "v8.0.28")).toBe("TZ=UTC\nCLIPROXYAPI_IMAGE_TAG=v8.0.28\n");
  });

  it("appends on a new line when the file has no trailing newline", () => {
    expect(withImageTag("TZ=UTC", "v8.0.28")).toBe("TZ=UTC\nCLIPROXYAPI_IMAGE_TAG=v8.0.28\n");
  });

  it("does not touch commented-out or similarly named keys", () => {
    const env = "#CLIPROXYAPI_IMAGE_TAG=v1.0.0\nX_CLIPROXYAPI_IMAGE_TAG=v1.0.0\n";
    expect(withImageTag(env, "v8.0.28")).toBe(`${env}CLIPROXYAPI_IMAGE_TAG=v8.0.28\n`);
  });

  it.each(["v8.0.28\nJWT_SECRET=x", "v8 0", "${HOME}", "", "-v8", "v8.0.28#x"])(
    "rejects the unsafe tag %j",
    (tag) => {
      expect(() => withImageTag("TZ=UTC\n", tag)).toThrow(/invalid image tag/i);
    }
  );
});

describe("writeInPlace", () => {
  it("rewrites the file without replacing it, so a single-file bind mount sees the change", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pin-"));
    const file = path.join(dir, ".env");
    await writeFile(file, "A=1\nCLIPROXYAPI_IMAGE_TAG=v8.0.29-long\nB=2\n");
    const before = await stat(file);

    await writeInPlace(file, "A=1\nB=2\n");

    expect(await readFile(file, "utf8")).toBe("A=1\nB=2\n");
    expect((await stat(file)).ino).toBe(before.ino);
  });
});

describe("isWritableFile", () => {
  it("is false when the env file is not mounted", async () => {
    expect(await isWritableFile("/nonexistent/host.env")).toBe(false);
  });

  it("is false for a read-only file", async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), "pin-")), ".env");
    await writeFile(file, "A=1\n", { mode: 0o444 });
    expect(await isWritableFile(file)).toBe(false);
  });

  it("is true for a writable file", async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), "pin-")), ".env");
    await writeFile(file, "A=1\n");
    expect(await isWritableFile(file)).toBe(true);
  });

  it("is false for a directory (Docker creates one for a missing bind source)", async () => {
    expect(await isWritableFile(tmpdir())).toBe(false);
  });
});
