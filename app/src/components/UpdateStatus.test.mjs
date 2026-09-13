import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const update = readFileSync(new URL("./UpdateStatus.jsx", import.meta.url), "utf8");

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
  assert.match(update, /Checking for updates…/);
  assert.match(update, /Downloading update…/);
  assert.match(update, /Update ready to install/);
  assert.match(
    update,
    /Will update after the current operation finishes/,
    "a deferred update must explain why it is waiting"
  );
  assert.match(update, /Installing update…/);
  assert.match(
    update,
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
