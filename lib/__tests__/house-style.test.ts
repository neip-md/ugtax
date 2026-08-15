/**
 * House style, enforced rather than remembered.
 *
 * Em-dashes and en-dashes are not used in this project's user-facing copy;
 * a spaced hyphen is used instead. 38 had accumulated across the two message
 * files, so this pins it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const DASHES = /[—–]/g;

describe("house style", () => {
  const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));

  it("finds the message files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no em-dash or en-dash", (file) => {
    const raw = readFileSync(path.join(MESSAGES_DIR, file), "utf8");
    const hits = raw.match(DASHES) ?? [];
    expect(
      hits,
      `${file} has ${hits.length} em/en-dash(es); use a spaced hyphen instead`,
    ).toHaveLength(0);
  });

  it.each(files)("%s stays valid JSON", (file) => {
    expect(() => JSON.parse(readFileSync(path.join(MESSAGES_DIR, file), "utf8"))).not.toThrow();
  });

  it("keeps the locales at identical key sets", () => {
    const keys = (obj: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(obj).flatMap(([k, v]) => {
        const p = prefix ? `${prefix}.${k}` : k;
        return typeof v === "object" && v !== null
          ? [p, ...keys(v as Record<string, unknown>, p)]
          : [p];
      });

    const sets = files.map((f) => ({
      file: f,
      keys: new Set(keys(JSON.parse(readFileSync(path.join(MESSAGES_DIR, f), "utf8")))),
    }));

    const [first, ...rest] = sets;
    for (const other of rest) {
      const missing = [...first.keys].filter((k) => !other.keys.has(k));
      const extra = [...other.keys].filter((k) => !first.keys.has(k));
      expect(missing, `${other.file} is missing keys present in ${first.file}`).toEqual([]);
      expect(extra, `${other.file} has keys absent from ${first.file}`).toEqual([]);
    }
  });
});
