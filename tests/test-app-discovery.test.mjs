import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { discoverTests } from "../scripts/test-app.mjs";

test("test discovery includes nested JS and MJS tests, excludes helpers, and sorts", () => {
  const root = mkdtempSync(join(tmpdir(), "diskern-discovery-"));
  try {
    mkdirSync(join(root, "components", "nested"), { recursive: true });
    const names = ["z.test.js", "components/a.test.mjs", "components/nested/b.test.js"];
    for (const name of [...names, "helper.mjs", "components/view.jsx"]) {
      writeFileSync(join(root, name), "");
    }
    assert.deepEqual(discoverTests(root), names.map((name) => join(root, name)).sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
