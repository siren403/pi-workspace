#!/usr/bin/env bun
import {
  EXTENSION_FEATURES,
  EXTENSION_PROFILES,
  EXTENSION_RECIPES,
  EXTENSIONS_CATALOG,
  type ExtensionPackage,
} from "../../../skills/pi-workspace/.mise/tasks/lib/extensions-catalog.ts";

const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function unique<T>(items: T[]): boolean {
  return new Set(items).size === items.length;
}

function validateUnique(label: string, values: string[]): void {
  if (unique(values)) return;
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  fail(`${label} has duplicates: ${[...duplicates].join(", ")}`);
}

function packageById(id: string): ExtensionPackage | undefined {
  return EXTENSIONS_CATALOG.find((item) => item.id === id);
}

const packageIds = EXTENSIONS_CATALOG.map((item) => item.id);
const packagePkgs = EXTENSIONS_CATALOG.map((item) => item.pkg);
const packageNames = EXTENSIONS_CATALOG.map((item) => item.name);
const featureIds = EXTENSION_FEATURES.map((item) => item.id);
const recipeIds = EXTENSION_RECIPES.map((item) => item.id);

validateUnique("extension package ids", packageIds);
validateUnique("extension packages", packagePkgs);
validateUnique("extension names", packageNames);
validateUnique("extension feature ids", featureIds);
validateUnique("extension recipe ids", recipeIds);
validateUnique("extension profile ids", EXTENSION_PROFILES.map((item) => item.id));

for (const ext of EXTENSIONS_CATALOG) {
  if (!isKebabCase(ext.id)) fail(`${ext.id}: id must be lowercase kebab-case`);
  if (!ext.pkg.startsWith("npm:")) fail(`${ext.id}: pkg must start with npm:`);
  if (ext.description.length < 12 || ext.description.length > 160) fail(`${ext.id}: description length must be 12..160 chars`);
  if (!ext.allowedScopes.includes(ext.recommendedScope)) fail(`${ext.id}: recommendedScope must be included in allowedScopes`);
  if (ext.recommendedScope === "user" && !ext.scopeRationale.trim()) fail(`${ext.id}: user recommendedScope requires scopeRationale`);
  if (ext.status === "recommended" && !ext.rationale?.trim()) fail(`${ext.id}: recommended status requires rationale`);
  if ((ext.status === "blocked" || ext.status === "deprecated") && ext.rationale?.includes("recommended")) {
    fail(`${ext.id}: blocked/deprecated package rationale must not imply recommendation`);
  }
  for (const featureId of ext.features) {
    if (!featureIds.includes(featureId)) fail(`${ext.id}: unknown feature reference ${featureId}`);
  }
}

for (const feature of EXTENSION_FEATURES) {
  if (!isKebabCase(feature.id)) fail(`${feature.id}: feature id must be lowercase kebab-case`);
  for (const packageId of [...feature.packages, ...(feature.optionalPackages ?? [])]) {
    if (!packageById(packageId)) fail(`${feature.id}: unknown package reference ${packageId}`);
  }
}

for (const recipe of EXTENSION_RECIPES) {
  if (!isKebabCase(recipe.id)) fail(`${recipe.id}: recipe id must be lowercase kebab-case`);
  if (!recipe.rationale.trim()) fail(`${recipe.id}: recipe rationale is required`);
  for (const featureId of recipe.features ?? []) {
    if (!featureIds.includes(featureId)) fail(`${recipe.id}: unknown feature reference ${featureId}`);
  }
  for (const packageId of [...(recipe.packages ?? []), ...(recipe.optionalPackages ?? [])]) {
    if (!packageById(packageId)) fail(`${recipe.id}: unknown package reference ${packageId}`);
  }
}

for (const profile of EXTENSION_PROFILES) {
  if (!isKebabCase(profile.id)) fail(`${profile.id}: extension profile id must be lowercase kebab-case`);
  if (profile.advisory !== true) fail(`${profile.id}: extension profile must be advisory`);
  if (!profile.rationale.trim()) fail(`${profile.id}: extension profile rationale is required`);
  for (const featureId of profile.features ?? []) {
    if (!featureIds.includes(featureId)) fail(`${profile.id}: unknown feature reference ${featureId}`);
  }
  for (const recipeId of profile.recipes ?? []) {
    if (!recipeIds.includes(recipeId)) fail(`${profile.id}: unknown recipe reference ${recipeId}`);
  }
  for (const packageId of profile.packages ?? []) {
    if (!packageById(packageId)) fail(`${profile.id}: unknown package reference ${packageId}`);
  }
}

const prohibitedProfileStatuses = new Set(["blocked", "deprecated"]);
for (const profile of EXTENSION_PROFILES) {
  const packageRefs = [
    ...(profile.packages ?? []),
    ...(profile.features ?? []).flatMap((featureId) => EXTENSION_FEATURES.find((item) => item.id === featureId)?.packages ?? []),
    ...(profile.recipes ?? []).flatMap((recipeId) => {
      const recipe = EXTENSION_RECIPES.find((item) => item.id === recipeId);
      return [
        ...(recipe?.packages ?? []),
        ...(recipe?.features ?? []).flatMap((featureId) => EXTENSION_FEATURES.find((item) => item.id === featureId)?.packages ?? []),
      ];
    }),
  ];
  for (const packageId of packageRefs) {
    const ext = packageById(packageId);
    if (ext && prohibitedProfileStatuses.has(ext.status)) fail(`${profile.id}: must not reference ${ext.status} package ${packageId}`);
  }
}

if (errors.length > 0) {
  console.error("[catalog-validate] failed");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("[catalog-validate] ok");
