import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles.css"),
  "utf8"
);

// The body of the `@media (prefers-reduced-motion: reduce)` block, found
// by walking braces from its opening '{' — a lazy regex would stop at the
// first inner rule's close.
export function reducedMotionBlock() {
  const marker = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/;
  const match = marker.exec(css);
  assert.ok(match, "styles.css must handle prefers-reduced-motion: reduce");

  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  for (; end < css.length && depth > 0; end++) {
    if (css[end] === "{") depth++;
    if (css[end] === "}") depth--;
  }
  return css.slice(start, end - 1);
}

// Same brace-walk for a `@keyframes <name> { … }` body.
export function keyframesBlock(name) {
  const marker = new RegExp(`@keyframes\\s+${name}\\s*\\{`);
  const match = marker.exec(css);
  assert.ok(match, `styles.css must define @keyframes ${name}`);

  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  for (; end < css.length && depth > 0; end++) {
    if (css[end] === "{") depth++;
    if (css[end] === "}") depth--;
  }
  return css.slice(start, end - 1);
}

// Layout-affecting properties: animating these is what would make the
// scan panel shift layout or feel jumpy.
export const LAYOUT_PROPS =
  /(?:^|[{;\s])(?:left|right|top|bottom|width|height|margin|padding)\s*:/;

