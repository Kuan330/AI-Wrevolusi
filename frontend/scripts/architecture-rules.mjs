import { relative, sep } from "node:path";
import ts from "typescript";

// Explicit storage owners: account cache/import and existing demo-only records.
const browserStorageOwners = new Set([
  "services/accountStorage.ts",
  "services/authService.ts",
  "services/planService.ts",
  "components/account/AccountProvider.tsx",
]);

function moduleReference(node) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal;
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) return node.moduleReference.expression;
  if (ts.isCallExpression(node) && (
    node.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(node.expression) && node.expression.text === "require")
  )) return node.arguments[0];
  return undefined;
}

export function checkSourceBoundaries(file, source, options, sourceRoot) {
  const sourceName = relative(sourceRoot, file).split(sep).join("/");
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const failures = new Set();
  const report = (message) => failures.add(`${sourceName}: ${message}`);
  const storageOwner = sourceName.startsWith("infrastructure/storage/") || browserStorageOwners.has(sourceName);
  const page = sourceName.match(/^pages\/([^/]+)\//)?.[1];

  function visit(node) {
    const browserStorageName = ts.isIdentifier(node) && ["localStorage", "sessionStorage"].includes(node.text);
    const browserStorageLookup = ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      ["localStorage", "sessionStorage"].includes(node.argumentExpression.text);
    if (!storageOwner && (browserStorageName || browserStorageLookup)) {
      report("browser storage must use an account repository or local-preference adapter");
    }

    const reference = moduleReference(node);
    if (reference && ts.isStringLiteralLike(reference)) {
      const specifier = reference.text;
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (resolved) {
        const target = relative(sourceRoot, resolved.resolvedFileName).split(sep).join("/");
        if (target.startsWith("pages/")) {
          if (sourceName.startsWith("features/") || sourceName.startsWith("services/") || sourceName.startsWith("infrastructure/") || sourceName.startsWith("components/ui/")) {
            report(`shared module must not depend on page internals (${target})`);
          }
          const targetPage = target.split("/")[1];
          if ((page === "Plan" && targetPage === "LearningCentre") || (page === "LearningCentre" && targetPage === "Plan")) {
            report("Plan and Learning Centre must use shared learning-planning contracts and operations");
          }
        }
        if (sourceName.startsWith("infrastructure/") && /^(features|services|components|routes)\//.test(target)) {
          report(`infrastructure must not depend on application modules (${target})`);
        }
      } else if ((specifier.startsWith("@/") || specifier.startsWith(".")) && !/\.(css|svg|png|jpe?g|webp)(\?.*)?$/.test(specifier)) {
        report(`cannot resolve local import ${specifier}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return [...failures];
}
