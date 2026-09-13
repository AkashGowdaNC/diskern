import assert from "node:assert/strict";
import { test } from "node:test";
import { css, reducedMotionBlock, keyframesBlock, LAYOUT_PROPS } from "../../test-support/styles.mjs";

test("the indeterminate scan bar stops sweeping under reduced motion", () => {
  const block = reducedMotionBlock();
  assert.match(
    block,
    /\.progress-fill-indeterminate\s*\{[^}]*animation\s*:\s*none\b/s,
    "the looping scan animation must be switched off, not just shortened"
  );
});

test("scan progress exposes a readable phase label", () => {
  assert.match(css, /\.progress-phase\s*\{/);
  assert.match(
    css,
    /\.progress-phase\s*\{[^}]*font-weight\s*:\s*600\b/s,
    "the phase should read as the main scan status, above the numeric counter"
  );
});

test("the scanning state is a branded panel, not a bare bar", () => {
  assert.match(
    css,
    /\.scan-progress\s*\{[^}]*border\s*:[^}]*border-radius\s*:/s,
    "the scan panel needs a bordered card treatment"
  );
  assert.match(css, /\.scan-mark\s*\{/, "a brand/shield mark must be styled");
  assert.match(css, /\.scan-status\s*\{[^}]*font-weight\s*:\s*600\b/s);
});

test("the scan mark pulses through transform and opacity only", () => {
  assert.match(css, /\.scan-mark\s*\{[^}]*animation\s*:[^}]*\bscan-pulse\b/s);
  const pulse = keyframesBlock("scan-pulse");
  assert.match(pulse, /opacity\s*:/);
  assert.match(pulse, /transform\s*:/);
  assert.doesNotMatch(
    pulse,
    LAYOUT_PROPS,
    "the pulse must not animate layout properties"
  );
});

test("the indeterminate sweep animates transform, never layout", () => {
  const sweep = keyframesBlock("indeterminate");
  assert.match(
    sweep,
    /transform\s*:\s*translateX\(/,
    "the sweep should move with translateX so it stays off layout"
  );
  assert.doesNotMatch(
    sweep,
    LAYOUT_PROPS,
    "animating left/top/width/height would shift layout every frame"
  );
});

test("cancelling calms the panel instead of snapping it away", () => {
  assert.match(
    css,
    /\.scan-progress\.cancelling\s*\{[^}]*opacity\s*:/s,
    "the cancelling panel should dim, not vanish"
  );
  assert.match(
    css,
    /\.scan-progress\.cancelling[^{]*\.progress-fill-indeterminate\s*\{[^}]*animation-play-state\s*:\s*paused/s,
    "the sweep should freeze in place while the scan stops"
  );
  assert.match(
    css,
    /\.scan-progress\.cancelling[^{]*\.scan-mark\b[^{]*\{[^}]*animation-play-state\s*:\s*paused/s,
    "the shield pulse should freeze too"
  );
});

test(".sr-only hides the live region visually, not from the a11y tree", () => {
  const block = /\.sr-only\s*\{([^}]*)\}/s.exec(css);
  assert.ok(block, "styles.css must define the .sr-only helper the live region uses");
  const body = block[1];
  assert.match(body, /position\s*:\s*absolute/);
  assert.match(body, /width\s*:\s*1px/);
  assert.match(body, /height\s*:\s*1px/);
  assert.match(body, /overflow\s*:\s*hidden/);
  assert.match(body, /clip\s*:\s*rect\(\s*0/);
  assert.doesNotMatch(
    body,
    /display\s*:\s*none|visibility\s*:\s*hidden/,
    "display:none or visibility:hidden would remove it from the a11y tree entirely"
  );
});

test("the scan panel enters with transform and opacity only", () => {
  assert.match(
    css,
    /\.scan-progress\s*\{[^}]*animation\s*:[^}]*\bscan-in\b/s,
    "the panel mounts on scan start and needs a short entrance"
  );
  const entrance = keyframesBlock("scan-in");
  assert.doesNotMatch(entrance, LAYOUT_PROPS);
});
