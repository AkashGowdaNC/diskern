import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const jsx = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "App.jsx"),
  "utf8"
);

// Just the ScanningIndicator component, from its declaration to the App
// component that follows it — the scan panel's whole markup lives there.
const scan = jsx.slice(
  jsx.indexOf("function ScanningIndicator"),
  jsx.indexOf("export default function App")
);
assert.ok(scan.length > 0, "App.jsx must define ScanningIndicator");

test("the scan panel keeps the same props contract", () => {
  assert.match(
    scan,
    /function ScanningIndicator\(\{ filesSeen, bytesSeen, phase, onCancel, cancelling \}\)/,
    "filesSeen / bytesSeen / onCancel / cancelling must keep working as today"
  );
});

test("the scan panel carries the shared brand mark", () => {
  assert.match(
    scan,
    /<BrandMark\s+className="scan-mark"\s*\/>/,
    "the shield glyph lives in BrandMark — one source, reused everywhere"
  );
});

test("the copy says plainly that scanning changes nothing", () => {
  assert.match(scan, /Scanning safely… nothing is being changed/);
});

test("the live counters still render from the same props", () => {
  assert.match(scan, /\{filesSeen\.toLocaleString\(\)\} files found/);
  assert.match(
    scan,
    /bytesSeen > 0 && <> · \{humanBytes\(bytesSeen\)\} so far<\/>/,
    "the byte counter still goes through humanBytes"
  );
});

test("cancelling gets its own calm state", () => {
  assert.match(
    scan,
    /cancelling \? " cancelling" : ""/,
    "the panel needs a cancelling modifier class"
  );
  assert.match(
    scan,
    /nothing has been changed/,
    "the cancelling copy should confirm nothing was touched"
  );
});

test("cancel still works the same way", () => {
  assert.match(scan, /onClick=\{onCancel\}/);
  assert.match(scan, /disabled=\{cancelling\}/);
  assert.match(scan, /cancelling \? "Stopping…" : "Cancel scan"/);
});


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

// The header lives inside App's JSX, not in the ScanningIndicator slice.
const header = jsx.slice(jsx.indexOf("<header>"), jsx.indexOf("</header>"));
assert.ok(header.length > 0, "App.jsx must render a <header>");

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
// Just the UpdateStatus component — the update toast's whole markup lives
// between its declaration and the App component that follows it.
const update = jsx.slice(
  jsx.indexOf("function UpdateStatus"),
  jsx.indexOf("export default function App")
);
assert.ok(update.length > 0, "App.jsx must define UpdateStatus");

test("the update toast keeps a simple props contract", () => {
  assert.match(
    update,
    /function UpdateStatus\(\{ status, onDismiss \}\)/,
    "the toast renders a status object and a dismiss callback, nothing more"
  );
});

test("the update toast stays out of the way when there is no status", () => {
  assert.match(
    update,
    /if \(!status\) return null;/,
    "before the first check — and after none/declined/dismissed — it renders nothing"
  );
});

test("the update toast is a live region carrying the phase", () => {
  assert.match(update, /role="status"/, "status text should announce itself politely");
  assert.match(
    update,
    /className=\{`update-status update-\$\{status\.phase\}`\}/,
    "each phase gets a modifier class so waiting and failing can look different"
  );
});

test("every updater phase has a calm line of copy", () => {
  assert.match(jsx, /Checking for updates…/);
  assert.match(jsx, /Downloading update…/);
  assert.match(jsx, /Update ready to install/);
  assert.match(
    jsx,
    /Will update after the current operation finishes/,
    "a deferred update must explain why it is waiting"
  );
  assert.match(jsx, /Installing update…/);
  assert.match(
    jsx,
    /Update failed — you can keep using Diskern/,
    "a failed update must reassure instead of looking frozen"
  );
});

test("only a failed update lingers, with a way to dismiss it", () => {
  assert.match(
    update,
    /status\.phase === "failed" && \(/,
    "other phases clear themselves — only failure keeps a toast around"
  );
  assert.match(update, /className="update-dismiss" onClick=\{onDismiss\}/);
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

// The CappedList helper — from its declaration to the CategorySection
// that follows it — is what keeps big reports from flooding the DOM.
const cappedList = jsx.slice(
  jsx.indexOf("function CappedList"),
  jsx.indexOf("function CategorySection")
);
assert.ok(cappedList.length > 0, "App.jsx must define CappedList");

test("long lists mount only a first page of rows", () => {
  assert.match(
    cappedList,
    /expanded \? items : items\.slice\(0, cap\)/,
    "collapsed lists must render a slice, not the whole array"
  );
  assert.match(
    cappedList,
    /useState\(false\)/,
    "each list owns its expanded flag so sections cap themselves independently"
  );
});

test("the toggle reveals the rest and can cap the list again", () => {
  assert.match(
    cappedList,
    /hidden > 0 && \(/,
    "no button when every item already fits"
  );
  assert.match(cappedList, /`Show \$\{hidden\} more`/);
  assert.match(cappedList, /Show less/);
  assert.match(cappedList, /setExpanded\(\(v\) => !v\)/);
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

test("capped lists keep the same list markup as before", () => {
  assert.match(cappedList, /<Tag className=\{className\}>/);
  assert.match(jsx, /className="findings"/);
  assert.match(jsx, /className="dup-paths"/);
});
