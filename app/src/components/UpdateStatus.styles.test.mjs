import assert from "node:assert/strict";
import { test } from "node:test";
import { css, reducedMotionBlock, keyframesBlock, LAYOUT_PROPS } from "../../test-support/styles.mjs";

test("the update toast is pinned out of the app's layout", () => {
  assert.match(
    css,
    /\.update-status\s*\{[^}]*position\s*:\s*fixed\b/s,
    "a status toast must float above the app, never push content around"
  );
  assert.match(css, /\.update-status\s*\{[^}]*bottom\s*:/s);
  assert.match(
    css,
    /\.update-status\s*\{[^}]*max-width\s*:/s,
    "it stays a small card even when the status text runs long"
  );
});

test("the update toast enters with transform and opacity only", () => {
  assert.match(
    css,
    /\.update-status\s*\{[^}]*animation\s*:[^}]*\bupdate-in\b/s,
    "each new status card gets the same short entrance as the scan panel"
  );
  const entrance = keyframesBlock("update-in");
  assert.doesNotMatch(entrance, LAYOUT_PROPS);
});

test("active update phases pulse the dot without touching layout", () => {
  // The pulsing rule may be a selector list, so allow other selectors
  // between the phase class and the declaration block.
  assert.match(
    css,
    /\.update-downloading\s+\.update-dot[^{]*\{[^}]*animation\s*:[^}]*\bupdate-pulse\b/s,
    "downloading needs proof of life"
  );
  assert.match(
    css,
    /\.update-installing\s+\.update-dot[^{]*\{[^}]*animation\s*:[^}]*\bupdate-pulse\b/s,
    "installing needs it too"
  );
  const pulse = keyframesBlock("update-pulse");
  assert.match(pulse, /opacity\s*:/);
  assert.match(pulse, /transform\s*:/);
  assert.doesNotMatch(pulse, LAYOUT_PROPS);
});

test("a deferred update looks calm, a failed one looks red", () => {
  // The default dot is a quiet grey — deferred simply doesn't repaint it.
  assert.match(
    css,
    /\.update-deferred\s+\.update-dot|\.update-dot\s*\{[^}]*rgba\(128,\s*128,\s*128/s,
    "waiting on the current operation should read as patient, not urgent"
  );
  assert.match(
    css,
    /\.update-failed\s+\.update-dot\s*\{[^}]*#c0392b/s,
    "failure gets the same red as every other error surface"
  );
  assert.match(css, /\.update-dismiss\s*\{/, "a failed toast can be dismissed");
});

test("the update dot settles instead of freezing mid-pulse", () => {
  const block = reducedMotionBlock();
  assert.match(
    block,
    /\.update-dot\s*\{[^}]*animation\s*:\s*none\b/s,
    "reduced motion should leave a steady dot, not a half-faded one"
  );
});
