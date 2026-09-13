import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// Explicit discovery works on Node 22 and Windows without shell globbing.
export function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discoverTests(path);
    return entry.isFile() && /\.test\.(mjs|js)$/.test(entry.name) ? [path] : [];
  }).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = discoverTests(fileURLToPath(new URL("../app/src", import.meta.url)));
  if (files.length === 0) throw new Error("No app tests found");
  console.log(`Running ${files.length} app test files (including component tests)`);
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
