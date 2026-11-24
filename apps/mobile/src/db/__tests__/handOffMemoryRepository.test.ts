import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";
import { createHandOffMemoryRepository } from "../repositories";

const repo = () =>
  createHandOffMemoryRepository(
    openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-hm-")), "t.db")).db as unknown as AnyDb,
  );

describe("handOffMemoryRepository", () => {
  it("round-trips two banks independently", async () => {
    const r = repo();
    expect(await r.getShareMemory()).toEqual({});
    await r.setShareResult("tcb", false);
    await r.setShareResult("vcb", true);
    expect(await r.getShareMemory()).toEqual({ tcb: "share_failed", vcb: "share_ok" });
    await r.setShareResult("tcb", true);
    expect((await r.getShareMemory()).tcb).toBe("share_ok");
  });
  it("remembers the dismissed suggestion", async () => {
    const r = repo();
    expect(await r.getDefaultSuggestionDismissed()).toBe(false);
    await r.dismissDefaultSuggestion();
    expect(await r.getDefaultSuggestionDismissed()).toBe(true);
  });
  it("remembers the last app per QR bank", async () => {
    const r = repo();
    expect(await r.getLastUsedByBank()).toEqual({});
    await r.setLastUsedForBank("970423", "tpbank");
    await r.setLastUsedForBank("970436", "momo");
    expect(await r.getLastUsedByBank()).toEqual({ "970423": "tpb", "970436": "momo" });
    await r.setLastUsedForBank("970423", "vcb");
    expect((await r.getLastUsedByBank())["970423"]).toBe("vcb");
    await r.setLastUsedForBank("", "vcb");
    expect(Object.keys(await r.getLastUsedByBank())).toHaveLength(2);
  });
});
