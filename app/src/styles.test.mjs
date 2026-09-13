import assert from "node:assert/strict";
import { test } from "node:test";
import { css, reducedMotionBlock, keyframesBlock, LAYOUT_PROPS } from "../test-support/styles.mjs";

test("the stylesheet handles prefers-reduced-motion", () => {
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
});

test("reduced motion collapses animations and transitions", () => {
  const block = reducedMotionBlock();
  assert.match(block, /animation-duration\s*:\s*0(\.\d+)?m?s\b/);
  assert.match(block, /animation-iteration-count\s*:\s*1\b/);
  assert.match(block, /transition-duration\s*:\s*0(\.\d+)?m?s\b/);
});

test("section bodies animate expand and collapse through the grid row", () => {
  // 0fr→1fr animates to natural height — no fixed max-height that could
  // clip a long findings list.
  assert.match(css, /\.group-body\s*\{[^}]*grid-template-rows\s*:\s*0fr\b/s);
  assert.match(css, /\.group-body\.open\s*\{[^}]*grid-template-rows\s*:\s*1fr\b/s);
  assert.match(
    css,
    /\.group-body\s*\{[^}]*transition\s*:[^}]*grid-template-rows\b/s,
    "the row animation must be a transition, not a jump"
  );
  // The clip wrapper is what lets the row shrink below content height.
  assert.match(css, /\.group-body-inner\s*\{[^}]*min-height\s*:\s*0\b/s);
  assert.match(css, /\.group-body-inner\s*\{[^}]*overflow\s*:\s*hidden\b/s);
});

test("a closed section body leaves the tab order", () => {
  assert.match(
    css,
    /\.group-body\s*\{[^}]*visibility\s*:\s*hidden\b/s,
    "collapsed content must not stay focusable"
  );
});

test("row actions fade and slide in on each state change", () => {
  assert.match(css, /@keyframes\s+action-in\b/);
  assert.match(
    css,
    /\.row-action\s*>\s*\*[^}]*animation\s*:\s*action-in\b/s,
    "idle/confirm/working swaps need the entrance animation"
  );
  assert.match(
    css,
    /\.purge\s*>\s*\*[^}]*animation\s*:\s*action-in\b/s,
    "the purge idle/confirm/working swap needs it too"
  );
});

test("working labels carry a spinner", () => {
  assert.match(css, /@keyframes\s+spin\b/);
  assert.match(
    css,
    /\.working::before\s*\{[^}]*animation\s*:[^}]*\bspin\b/s,
    "Moving…/Restoring…/Deleting… should spin, not just sit there"
  );
});

test("the row-action column is pinned so buttons do not jump", () => {
  assert.match(
    css,
    /\.row-action\s*\{[^}]*min-width\s*:/s,
    "the auto column must out-size every state so swaps don't resize the row"
  );
});

test("the chevron rotates instead of swapping glyphs", () => {
  assert.match(css, /\.chevron\s*\{[^}]*transition\s*:[^}]*transform\b/s);
  assert.match(css, /\.chevron\.open\s*\{[^}]*transform\s*:\s*rotate\s*\(/s);
});

test("the shared mark has a sane default size", () => {
  // BrandMark renders no width/height attributes, so bare usage would
  // fall back to the replaced-element default (300×150) without this.
  assert.match(css, /\.brand-mark\s*\{[^}]*width\s*:/s);
});

test("the header pairs the brand mark with the wordmark", () => {
  assert.match(
    css,
    /\.brand\s*\{[^}]*display\s*:\s*flex\b/s,
    "the brand row lays mark and wordmark side by side"
  );
  assert.match(
    css,
    /\.header-mark\s*\{[^}]*width\s*:/s,
    "the header variant sizes the shared mark"
  );
});

test("preview rows have a quiet non-action label", () => {
  assert.match(css, /\.preview-note\s*\{/);
  assert.match(css, /\.preview-only\s*\{[^}]*opacity\s*:/s);
});
