import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const jsx = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const header = jsx.slice(jsx.indexOf("<header>"), jsx.indexOf("</header>"));
assert.ok(header.length > 0, "App.jsx must render a <header>");

test("the app subscribes to provisional scan preview events", () => {
  assert.match(jsx, /listen\("scan-preview"/);
  assert.match(jsx, /setPreviewReport\(\(prev\) =>/);
  assert.match(jsx, /byPath\.set\(finding\.entry\.path, finding\)/);
  assert.match(jsx, /duplicate_sets:\s*\[\]/);
});

test("preview findings are not actionable until the final report arrives", () => {
  assert.match(jsx, /actionsDisabled=\{showingPreview\}/);
  assert.match(jsx, /Preview only/);
  assert.match(jsx, /Final safety checks and actions unlock/);
});

test("App imports the shared BrandMark component", () => {
  assert.match(jsx, /import BrandMark from "\.\/BrandMark\.jsx";/);
});

test("the header pairs the brand mark with the wordmark", () => {
  assert.match(
    header,
    /<BrandMark\s+className="header-mark"\s*\/>/,
    "the header reuses the same mark component, not a copy of the SVG"
  );
  assert.match(header, /<h1>Diskern<\/h1>/);
  assert.ok(
    header.indexOf("<BrandMark") < header.indexOf("<h1>"),
    "the mark leads the wordmark in the brand row"
  );
});

test("the app subscribes to the shared update status store", () => {
  const app = jsx.slice(jsx.indexOf("export default function App"));
  assert.match(
    app,
    /useSyncExternalStore\(\s*subscribeUpdateStatus,\s*getUpdateStatus\s*\)/,
    "the checker runs outside React — App must read its status from the store"
  );
  assert.match(app, /<UpdateStatus\s+status=\{updateStatus\}/s);
});

test("every findings category is capped at the issue's suggested page", () => {
  assert.match(jsx, /const FINDINGS_CAP = 100;/);
  assert.match(
    jsx,
    /<CappedList[^>]*className="findings"[^>]*items=\{catItems\}[^>]*cap=\{FINDINGS_CAP\}/s,
    "category blocks must render finding rows through the cap"
  );
});

test("duplicate sets and their paths are capped too", () => {
  assert.match(jsx, /const DUP_SETS_CAP = 100;/);
  assert.match(jsx, /const DUP_PATHS_CAP = 25;/);
  assert.match(
    jsx,
    /<CappedList[^>]*items=\{sets\}[^>]*cap=\{DUP_SETS_CAP\}/s,
    "the duplicates panel must cap the number of sets it mounts"
  );
  assert.match(
    jsx,
    /<CappedList[^>]*items=\{set\.paths\}[^>]*cap=\{DUP_PATHS_CAP\}/s,
    "a set with many paths must not render them all at once"
  );
});

test("capped lists retain the findings and duplicate-path styling hooks", () => {
  assert.match(jsx, /className="findings"/);
  assert.match(jsx, /className="dup-paths"/);
});

test("finding rows display a category badge", () => {
  assert.match(
    jsx,
    /<span className="category-badge">\s*\{CATEGORY_LABEL\[f\.category\] \?\? f\.category\}\s*<\/span>/,
    "each finding row should show a readable category badge"
  );
});

