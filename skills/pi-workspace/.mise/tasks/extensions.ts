#!/usr/bin/env bun
/**
 * mise run extensions -- --target <path> [--install <pkg,...>] [--list]
 *
 * 옵션 없음:   카탈로그 + 현재 설치 상태 출력
 * --list:      위와 동일
 * --install:   쉼표 구분 패키지명으로 pi install -l 실행
 *              예) --install context-mode,pi-lens
 */
import { parseArgs } from "util";
import { $ } from "bun";
import { resolve } from "path";
import { EXTENSIONS_CATALOG, CATEGORY_LABEL } from "./lib/extensions-catalog.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string",  default: "." },
    install: { type: "string" },
    list:    { type: "boolean", default: false },
  },
});

const target = resolve(values.target!);

// 현재 설치된 패키지 목록 (pi list 파싱)
async function getInstalledPkgs(): Promise<Set<string>> {
  const r = await $`pi list`.quiet().nothrow();
  const text = r.stdout.toString() + r.stderr.toString();
  const installed = new Set<string>();
  for (const line of text.split("\n")) {
    const m = line.match(/npm:(@?[\w\-\/\.]+)/);
    if (m) installed.add(`npm:${m[1]}`);
  }
  return installed;
}

async function printCatalog(installed: Set<string>) {
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
      const status = installed.has(ext.pkg) ? "✓" : ext.recommended ? "·" : " ";
      const tag = ext.recommended ? " (권장)" : "";
      console.log(`    ${status} ${ext.name}${tag}`);
      console.log(`      ${ext.description}`);
      console.log(`      ${ext.pkg}`);
    }
    console.log();
  }
  console.log("  ✓ = 설치됨   · = 권장 미설치   설치: --install <name,...>\n");
}

async function installPackages(names: string[], installed: Set<string>) {
  // name → pkg 매핑
  const byName = new Map(EXTENSIONS_CATALOG.map((e) => [e.name, e]));
  const byPkg  = new Map(EXTENSIONS_CATALOG.map((e) => [e.pkg.replace("npm:", ""), e]));

  const toInstall: string[] = [];
  const unknown: string[] = [];

  for (const name of names) {
    const ext = byName.get(name) ?? byPkg.get(name);
    if (!ext) { unknown.push(name); continue; }
    if (installed.has(ext.pkg)) {
      console.log(`  ✓ ${ext.name} 이미 설치됨`);
      continue;
    }
    toInstall.push(ext.pkg);
  }

  if (unknown.length) {
    console.error(`  ✗ 알 수 없는 패키지: ${unknown.join(", ")}`);
    console.error("    카탈로그 확인: mise run extensions -- --list");
  }

  for (const pkg of toInstall) {
    console.log(`  → pi install ${pkg} -l`);
    const r = await $`pi install ${pkg} -l`.cwd(target).quiet().nothrow();
    if (r.exitCode === 0) {
      console.log(`    ✓ 설치 완료`);
    } else {
      console.error(`    ✗ 실패: ${r.stderr.toString().trim()}`);
    }
  }
}

const installed = await getInstalledPkgs();

if (values.install) {
  const names = values.install.split(",").map((s) => s.trim()).filter(Boolean);
  await installPackages(names, installed);
} else {
  await printCatalog(installed);
}
