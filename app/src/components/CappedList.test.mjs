import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const cappedList = readFileSync(new URL("./CappedList.jsx", import.meta.url), "utf8");

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

test("capped lists keep the same list markup as before", () => {
  assert.match(cappedList, /<Tag className=\{className\}>/);
});
