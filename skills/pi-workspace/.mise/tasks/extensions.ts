#!/usr/bin/env bun
/**
 * mise run extensions -- --target <path> [--install <pkg,...>] [--scope project|user] [--feature <id>] [--recipe <id>] [--profile <id>] [--list]
 *
 * 옵션 없음:   카탈로그 + 현재 설치 상태/추천 스코프 출력
 * --list:      feature/recipe/profile 포함 전체 카탈로그 출력
 * --feature:   feature 기반 추천 출력
 * --recipe:    recipe 기반 추천 출력
 * --profile:   profile 기반 추천 출력
 * --install:   쉼표 구분 패키지명으로 pi install 실행
 * --scope:     project면 -l, user면 user scope 설치
 */
import { parseArgs } from "util";
import { $ } from "bun";
import { resolve } from "path";
import {
  CATEGORY_LABEL,
  EXTENSION_FEATURES,
  EXTENSION_PROFILES,
  EXTENSION_RECIPES,
  EXTENSIONS_CATALOG,
  type ExtensionPackage,
  type ExtensionScope,
  findExtensionPackage,
  resolveFeaturePackageIds,
  resolveProfilePackageIds,
  resolveRecipePackageIds,
} from "./lib/extensions-catalog.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string", default: "." },
    install: { type: "string" },
    scope:   { type: "string" },
    feature: { type: "string" },
    recipe:  { type: "string" },
    profile: { type: "string" },
    list:    { type: "boolean", default: false },
  },
});

const target = resolve(values.target!);
const requestedScope = values.scope as ExtensionScope | undefined;

type InstallState = {
  visible: Set<string>;
  project: Set<string>;
};

type RecommendationSource =
  | { kind: "feature"; id: string; packageIds: string[] }
  | { kind: "recipe"; id: string; packageIds: string[] }
  | { kind: "profile"; id: string; packageIds: string[] };

async function readProjectPackages(): Promise<Set<string>> {
  try {
    const settings = await Bun.file(resolve(target, ".pi", "settings.json")).json() as { packages?: string[] };
    return new Set(settings.packages ?? []);
  } catch {
    return new Set();
  }
}

// pi list는 user/project scope를 안정적으로 구분하지 못할 수 있어 visible 상태로만 사용한다.
async function readVisiblePackages(): Promise<Set<string>> {
  const r = await $`pi list`.cwd(target).quiet().nothrow();
  const text = r.stdout.toString() + r.stderr.toString();
  const installed = new Set<string>();
  for (const line of text.split("\n")) {
    const m = line.match(/npm:(@?[\w\-\/\.]+)/);
    if (m) installed.add(`npm:${m[1]}`);
  }
  return installed;
}

async function getInstalledPkgs(): Promise<InstallState> {
  const [visible, project] = await Promise.all([
    readVisiblePackages(),
    readProjectPackages(),
  ]);
  return { visible, project };
}

function installStateLabel(ext: ExtensionPackage, installed: InstallState): string {
  if (installed.project.has(ext.pkg)) return "project";
  if (installed.visible.has(ext.pkg)) return "user/inherited";
  return "missing";
}

function statusSymbol(ext: ExtensionPackage, installed: InstallState): string {
  const state = installStateLabel(ext, installed);
  if (state === "project") return ext.recommendedScope === "project" ? "✓" : "◇";
  if (state === "user/inherited") return ext.recommendedScope === "user" ? "✓" : "◇";
  return ext.status === "recommended" ? "·" : " ";
}

function printExtension(ext: ExtensionPackage, installed: InstallState): void {
  const status = statusSymbol(ext, installed);
  const installedAt = installStateLabel(ext, installed);
  const tag = ext.status === "recommended" ? " (권장)" : ext.status === "experimental" ? " (실험적)" : "";
  console.log(`    ${status} ${ext.name}${tag}`);
  console.log(`      ${ext.description}`);
  console.log(`      ${ext.pkg}`);
  console.log(`      install: ${installedAt}; recommended scope: ${ext.recommendedScope}`);
  console.log(`      scope reason: ${ext.scopeRationale}`);
  if (ext.rationale) console.log(`      rationale: ${ext.rationale}`);
  if (ext.risks?.length) console.log(`      risks: ${ext.risks.join(", ")}`);
  if (status === "◇") {
    console.log("      note: installed at a non-recommended or ambiguous scope; advice only, no removal is generated.");
  }
}

async function printCatalog(installed: InstallState) {
  const byCategory = new Map<string, typeof EXTENSIONS_CATALOG>();
  for (const ext of EXTENSIONS_CATALOG) {
    const list = byCategory.get(ext.category) ?? [];
    list.push(ext);
    byCategory.set(ext.category, list);
  }

  console.log("\n[extensions] Pi extension catalog\n");
  for (const [cat, exts] of byCategory) {
    console.log(`  ${CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}`);
    for (const ext of exts) {
      printExtension(ext, installed);
    }
    console.log();
  }
  console.log("  ✓ = recommended scope에 설치됨   ◇ = 다른/불명확한 scope에 설치됨   · = 권장 미설치");
  console.log("  설치: --install <name,...> --scope project|user\n");

  if (values.list) {
    console.log("[extensions] Features\n");
    for (const item of EXTENSION_FEATURES) {
      console.log(`  - ${item.id}: ${item.description}`);
      console.log(`    packages: ${item.packages.join(", ")}${item.optionalPackages?.length ? `; optional: ${item.optionalPackages.join(", ")}` : ""}`);
    }

    console.log("\n[extensions] Recipes\n");
    for (const item of EXTENSION_RECIPES) {
      console.log(`  - ${item.id}: ${item.description}`);
      console.log(`    rationale: ${item.rationale}`);
    }

    console.log("\n[extensions] Profiles (advisory)\n");
    for (const item of EXTENSION_PROFILES) {
      console.log(`  - ${item.id}: ${item.description}`);
      console.log(`    rationale: ${item.rationale}`);
    }
    console.log("");
  }
}

function dedupePackageIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function buildRecommendationSource(): RecommendationSource | null {
  if (values.feature) return { kind: "feature", id: values.feature, packageIds: resolveFeaturePackageIds(values.feature) };
  if (values.recipe) return { kind: "recipe", id: values.recipe, packageIds: resolveRecipePackageIds(values.recipe) };
  if (values.profile) return { kind: "profile", id: values.profile, packageIds: resolveProfilePackageIds(values.profile) };
  return null;
}

function printRecommendation(source: RecommendationSource, installed: InstallState): void {
  const packageIds = dedupePackageIds(source.packageIds);
  console.log(`\n[extensions] Recommendation: ${source.kind} ${source.id}\n`);
  if (packageIds.length === 0) {
    console.log("  No matching recommendation found.");
    console.log("  Use --list to inspect available features, recipes, and profiles.\n");
    return;
  }

  for (const packageId of packageIds) {
    const ext = findExtensionPackage(packageId);
    if (!ext) {
      console.log(`  ! unknown package reference: ${packageId}`);
      continue;
    }
    printExtension(ext, installed);
  }

  console.log("\n  This recommendation is advisory. It does not install or remove packages.");
  console.log("  To install selected packages, rerun with --install <name,...> --scope project|user.");
  console.log("  If --scope is omitted during install, each package uses its catalog recommended scope.\n");
}

async function installPackages(names: string[], installed: InstallState) {
  const toInstall: string[] = [];
  const unknown: string[] = [];
  const blocked: string[] = [];

  for (const name of names) {
    const ext = findExtensionPackage(name);
    if (!ext) { unknown.push(name); continue; }
    if (ext.status === "blocked") {
      blocked.push(name);
      continue;
    }

    const scope = requestedScope ?? ext.recommendedScope;
    if (!ext.allowedScopes.includes(scope)) {
      console.error(`  ✗ ${ext.name}: ${scope} scope is not allowed. allowed: ${ext.allowedScopes.join(", ")}`);
      continue;
    }

    const installedAt = installStateLabel(ext, installed);
    if ((scope === "project" && installed.project.has(ext.pkg)) || (scope === "user" && installedAt === "user/inherited")) {
      console.log(`  ✓ ${ext.name} already installed at ${scope === "user" ? "user/inherited" : "project"} scope`);
      continue;
    }
    toInstall.push(`${ext.id}:${scope}`);
  }

  if (unknown.length) {
    console.error(`  ✗ 알 수 없는 패키지: ${unknown.join(", ")}`);
    console.error("    카탈로그 확인: mise run extensions -- --list");
  }

  if (blocked.length) {
    console.error(`  ✗ blocked packages: ${blocked.join(", ")}`);
  }

  for (const entry of toInstall) {
    const [id, scope] = entry.split(":") as [string, ExtensionScope];
    const ext = findExtensionPackage(id)!;
    console.log(`  → ${scope === "project" ? `pi install ${ext.pkg} -l` : `pi install ${ext.pkg}`}`);
    console.log(`    scope: ${scope}; reason: ${ext.scopeRationale}`);
    const r = scope === "project"
      ? await $`pi install ${ext.pkg} -l`.cwd(target).quiet().nothrow()
      : await $`pi install ${ext.pkg}`.cwd(target).quiet().nothrow();
    if (r.exitCode === 0) {
      console.log(`    ✓ 설치 완료`);
    } else {
      console.error(`    ✗ 실패: ${r.stderr.toString().trim()}`);
    }
  }
}

const installed = await getInstalledPkgs();

if (values.install) {
  if (requestedScope && requestedScope !== "project" && requestedScope !== "user") {
    console.error("  ✗ --scope must be project or user");
    process.exit(1);
  }
  const names = values.install.split(",").map((s) => s.trim()).filter(Boolean);
  await installPackages(names, installed);
} else if (buildRecommendationSource()) {
  printRecommendation(buildRecommendationSource()!, installed);
} else {
  await printCatalog(installed);
}
