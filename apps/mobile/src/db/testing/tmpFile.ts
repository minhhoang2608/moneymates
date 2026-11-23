import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const tmpDbFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pref-")), "t.db");
export const tick = () => new Promise((r) => setTimeout(r, 3));
