import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../src/", import.meta.url);
const sourceRoot = fileURLToPath(root);
const sourceExtensions = new Set([".ts", ".tsx"]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

const failures = [];
for (const file of sourceFiles(sourceRoot)) {
  const name = relative(sourceRoot, file).split(sep).join("/");
  const source = readFileSync(file, "utf8");

  if (
    !name.startsWith("infrastructure/storage/") &&
    /\b(?:localStorage|sessionStorage)\b/.test(source)
  ) {
    failures.push(`${name}: browser storage must go through infrastructure/storage`);
  }

  if (name.startsWith("features/") && /from\s+["']@\/pages\//.test(source)) {
    failures.push(`${name}: features must not import route pages`);
  }

  const pageMatch = name.match(/^pages\/([^/]+)\//);
  if (!pageMatch) continue;
  const owner = pageMatch[1];
  for (const match of source.matchAll(/from\s+["']@\/pages\/([^/]+)\//g)) {
    if (match[1] !== owner) {
      failures.push(
        `${name}: page ${owner} must not import page ${match[1]}; move the shared contract to features or shared UI`,
      );
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Frontend architecture boundaries passed.");
}
