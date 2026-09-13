import assert from "node:assert/strict";
import { test } from "node:test";
import { css, reducedMotionBlock, keyframesBlock, LAYOUT_PROPS } from "../../test-support/styles.mjs";

test("the show-more toggle is a quiet secondary button", () => {
  assert.match(css, /\.list-toggle\s*\{[^}]*border\s*:/s);
  assert.match(css, /\.list-toggle\s*\{[^}]*background\s*:\s*none\b/s);
  assert.match(
    css,
    /\.list-toggle\s*\{[^}]*opacity\s*:/s,
    "the cap is a performance detail — it should not compete with real actions"
  );
});
