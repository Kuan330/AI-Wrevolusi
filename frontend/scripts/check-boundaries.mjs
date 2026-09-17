import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { checkSourceBoundaries } from "./architecture-rules.mjs";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(frontendRoot, "src");
const configPath = join(frontendRoot, "tsconfig.app.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const { options, errors } = ts.parseJsonConfigFileContent(config.config, ts.sys, frontendRoot);
if (errors.length) throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}
const failures = sourceFiles(sourceRoot).flatMap((file) =>
  checkSourceBoundaries(file, readFileSync(file, "utf8"), options, sourceRoot),
);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Frontend architecture boundaries passed.");
}
