#!/usr/bin/env node
// sitemap.xml : 공개 · 검색 허용 면만 싣는다 (2026-10-20 · 브랜딩 공개 준비 ⑤).
// 대상 : 배포되는 index.html 중 넘김 껍데기가 아니고 robots 에 noindex 가 없는 면.
// 주소는 면이 스스로 적은 canonical 을 그대로 쓴다. canonical 이 바깥 주소이거나 없으면 멈춘다.
// lastmod 는 싣지 않는다 : 정확하지 않은 날짜보다 없는 쪽이 낫다.
// 쓰기 : node scripts/build-sitemap.mjs --check | --write
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://kiheon.com";

async function walk(root, dir = "", out = []) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel", "tests"].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(root, rel, out);
    else out.push(rel);
  }
  return out;
}

export async function indexablePages(root = repoRoot) {
  const ignored = (await readFile(path.join(root, ".vercelignore"), "utf8")).split("\n")
    .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const pages = [];
  for (const file of await walk(root)) {
    if (!file.endsWith("index.html")) continue;
    if (ignored.some((rule) => rule.endsWith("/") ? file.startsWith(rule) : file === rule || file.split("/")[0] === rule)) continue;
    const html = await readFile(path.join(root, file), "utf8");
    if (/http-equiv="refresh"/i.test(html)) continue;
    const robots = html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? "";
    if (/noindex/i.test(robots)) continue;
    const expected = `${ORIGIN}/${file.slice(0, -"index.html".length)}`;
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (canonical !== expected) throw new Error(`${file} : canonical ${canonical ?? "(없음)"} 이 ${expected} 와 다르다`);
    pages.push(canonical);
  }
  return pages.sort();
}

export async function renderSitemap(root = repoRoot) {
  const urls = (await indexablePages(root)).map((loc) => `  <url><loc>${loc}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!["--check", "--write"].includes(mode)) {
    console.error("usage: node scripts/build-sitemap.mjs --check | --write");
    process.exit(2);
  }
  const next = await renderSitemap();
  const target = path.join(repoRoot, "sitemap.xml");
  const current = await readFile(target, "utf8").catch(() => "");
  const count = next.split("<url>").length - 1;
  if (mode === "--write") {
    if (current !== next) await writeFile(target, next);
    console.log(`sitemap.xml : ${count} 면${current === next ? " (같음)" : " (썼다)"}`);
  } else if (current !== next) {
    console.error(`stale sitemap.xml : 생성기는 ${count} 면`);
    process.exit(1);
  } else {
    console.log(`sitemap.xml : ${count} 면 (같음)`);
  }
}
