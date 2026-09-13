import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const scan = readFileSync(new URL("./ScanningIndicator.jsx", import.meta.url), "utf8");

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

test("phase transitions announce politely, without the count ticks", () => {
  const liveRegion = /<p\s+className="sr-only"\s+aria-live="polite"[^>]*>([\s\S]*?)<\/p>/.exec(
    scan
  );
  assert.ok(
    liveRegion,
    "a visually-hidden polite live region must carry the scan phase"
  );
  assert.match(liveRegion[1], /phase\b/, "the region announces the scan phase");
  assert.doesNotMatch(
    liveRegion[1],
    /filesSeen|bytesSeen/,
    "the ~150ms file/byte ticks must stay out of the announced text"
  );
  assert.match(
    liveRegion[0],
    /aria-atomic="true"/,
    "announce the whole phrase, not a diff of it"
  );
});

test("cancelling is announced as a status change, not silence", () => {
  assert.match(
    scan,
    /aria-live="polite"[\s\S]*?cancelling\s*\?\s*"Stopping the scan/,
    "pressing Cancel should announce that the scan is stopping"
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
