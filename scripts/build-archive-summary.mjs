#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentLibrary } from "../assets/content-manifest.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cleanText = (value) => String(value ?? "").replaceAll("\u2014", "·");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Render all targets and validate identity/markup before writing either output.
export async function renderArchiveSummary({ root = repoRoot, library = contentLibrary } = {}) {
  const series = library.series;
  const posts = series.flatMap((entry) => entry.posts ?? []);
  const sources = series.flatMap((entry) => entry.sources ?? []);
  const registeredSources = series.flatMap((entry) =>
    (entry.sources ?? []).map((source) => ({
      id: source.id,
      title: cleanText(source.title),
      description: cleanText(source.description),
      label: cleanText(source.label),
      published: source.published,
      sourceYears: source.sourceYears ?? [],
      href: source.href,
      seriesSlug: entry.slug,
      seriesLabel: cleanText(entry.label),
      seriesTitle: cleanText(entry.title),
    })),
  );
  const sourceKeys = new Set(), sourceHrefs = new Set();
  for (const source of registeredSources) {
    const key = `${source.seriesSlug}:${source.id}`;
    if (!/^[a-z0-9-]+$/.test(source.id ?? "") || sourceKeys.has(key)
        || !source.href || sourceHrefs.has(source.href)) {
      throw new Error("Archive source identity is missing or duplicated");
    }
    sourceKeys.add(key); sourceHrefs.add(source.href);
  }
  const sourceTitleCounts = new Map();
  for (const source of registeredSources) {
    sourceTitleCounts.set(source.title, (sourceTitleCounts.get(source.title) ?? 0) + 1);
  }
  for (const source of registeredSources) {
    const sourceLabel = source.label.replace(/^SOURCE ·\s*/, "");
    source.displayTitle = sourceTitleCounts.get(source.title) > 1
      ? `${source.title} · ${sourceLabel}`
      : source.title;
  }

  const presentationArchiveHref = "series/metaverse-era/sources/presentations/";
  const presentationArchiveHtml = await readFile(
    path.join(root, presentationArchiveHref, "index.html"),
    "utf8",
  );
  const presentationArchiveList =
    presentationArchiveHtml.match(/<section class="pa-index"[\s\S]*?<\/section>/)?.[0] ?? "";
  const presentationArchiveItems = [
    ...presentationArchiveList.matchAll(/<li id="([^"]+)">([\s\S]*?)<\/li>/g),
  ].map((match) => ({
    id: match[1],
    isLineage: /발표 자료 계보/.test(match[2]),
    years: [...match[2].matchAll(/\b(20\d{2})\b/g)].map((year) => Number(year[1])),
  }));

  if (!presentationArchiveItems.length
      || new Set(presentationArchiveItems.map((entry) => entry.id)).size !== presentationArchiveItems.length) {
    throw new Error("Presentation archive entries are missing or duplicated");
  }
  const sourceYears = Array.from(
    new Set([
      ...series.flatMap((entry) => entry.sourceYears ?? []),
      ...posts.flatMap((entry) => entry.sourceYears ?? []),
      ...sources.flatMap((entry) => entry.sourceYears ?? []),
      ...presentationArchiveItems.flatMap((entry) => entry.years),
    ]),
  ).sort((a, b) => a - b);

  const payload = {
    schemaVersion: "public-archive-summary-v1",
    generatedFrom: [
      "assets/content-manifest.js",
      "series/metaverse-era/sources/presentations/index.html",
    ],
    inputSha256: {
      "assets/content-manifest.js": digest(await readFile(path.join(root, "assets/content-manifest.js"))),
      [presentationArchiveHref + "index.html"]: digest(Buffer.from(presentationArchiveHtml)),
    },
    counts: {
      publicSeries: series.length,
      publishedPosts: posts.length,
      manifestSources: sources.length,
      presentationArchiveItems:
        presentationArchiveItems.length,
      presentationVideos: presentationArchiveItems.filter((entry) => !entry.isLineage).length,
      presentationLineages: presentationArchiveItems.filter((entry) => entry.isLineage).length,
    },
    sourceYears,
    registeredSeries: series.map((entry) => ({
      slug: entry.slug,
      label: cleanText(entry.label),
      title: cleanText(entry.title),
      href: entry.href,
      posts: (entry.posts ?? []).length,
      sources: (entry.sources ?? []).length,
      hasCover: Boolean(entry.cover),
    })),
    registeredSources,
    availability: {
      publicLinks: "links-open-the-current-public-surface",
      localVault: "originals-and-unregistered-source-pages-are-not-counted-here",
    },
  };


  const archivePath = path.join(root, "archive/index.html");
  let archiveHtml = await readFile(archivePath, "utf8");
  const period = `${sourceYears.at(0)}–${sourceYears.at(-1)}`;
  const replaceAttributeText = (attribute, key, value) => {
    const pattern = new RegExp(
      `(<(?:span|b) ${attribute}="${key}">)[^<]*(</(?:span|b)>)`,
    );
    if (!pattern.test(archiveHtml)) {
      throw new Error(`archive summary target missing: ${attribute}=${key}`);
    }
    archiveHtml = archiveHtml.replace(pattern, `$1${value}$2`);
  };
  replaceAttributeText(
    "data-archive-summary",
    "headline",
    `공개 시리즈 ${payload.counts.publicSeries}개 · 글 ${payload.counts.publishedPosts}편 · 등록 자료 ${payload.counts.manifestSources}개`,
  );
  replaceAttributeText(
    "data-archive-summary",
    "presentations",
    `발표 아카이브 ${payload.counts.presentationArchiveItems}편 · ${period}`,
  );
  for (const key of [
    "publicSeries",
    "publishedPosts",
    "manifestSources",
    "presentationArchiveItems",
  ]) {
    replaceAttributeText("data-archive-count", key, payload.counts[key]);
  }
  replaceAttributeText("data-archive-range", "sourceYears", period);

  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const sourceRows = registeredSources.map((source) => {
    const published = source.published?.replaceAll("-", ".")
      ?? source.sourceYears.join("–");
    const sourceLabel = source.label.replace(/^SOURCE ·\s*/, "");
    const description = source.description.replace(
      new RegExp(`^${published.replaceAll(".", "\\.")} ·\\s*`),
      "",
    );
    const meta = [source.seriesLabel, sourceLabel === source.title ? "" : sourceLabel, published]
      .filter(Boolean)
      .join(" · ");
    const sourceKey = `${source.seriesSlug}:${source.id}`;
    return `        <div class="arc-stock__row" data-access="open" data-source-key="${escapeHtml(sourceKey)}" data-title="${escapeHtml(source.displayTitle)}" data-meta="${escapeHtml(meta)}" data-description="${escapeHtml(description)}"><dt><a class="arc-stock__link" href="../${escapeHtml(source.href)}"><span class="arc-stock__title">${escapeHtml(source.displayTitle)}</span><span class="arc-stock__action"><svg class="klu-icon" data-icon="arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg><span class="arc-stock__action-label">자료 보기</span></span></a></dt><dd><span class="arc-stock__status">열람 가능</span><span class="arc-stock__meta">${escapeHtml(meta)}</span><span class="arc-stock__description">${escapeHtml(description)}</span></dd></div>`;
  }).join("\n");
  const sourceStart = "        <!-- ARCHIVE_REGISTERED_SOURCES:START -->";
  const sourceEnd = "        <!-- ARCHIVE_REGISTERED_SOURCES:END -->";
  const sourcePattern = new RegExp(
    `${sourceStart}[\\s\\S]*?${sourceEnd}`,
  );
  if (!sourcePattern.test(archiveHtml)) {
    throw new Error("Archive registered-source block missing");
  }
  archiveHtml = archiveHtml.replace(
    sourcePattern,
    `${sourceStart}\n${sourceRows}\n${sourceEnd}`,
  );
  // A newly registered source must not silently coexist with an older manual row.
  const inventory = archiveHtml.match(/<section class="arc-stock"[\s\S]*?<\/section>/)?.[0] ?? "";
  const rows = inventory.match(/<div class="arc-stock__row"[^>]*>[\s\S]*?<\/div>/g) ?? [];
  for (const source of registeredSources) {
    const href = `href="../${escapeHtml(source.href)}"`;
    if (rows.filter((row) => row.includes(href)).length !== 1) {
      throw new Error(`Archive source needs exactly one inventory row: ${source.seriesSlug}:${source.id}`);
    }
  }
  return {
    counts: payload.counts,
    outputs: {
      "assets/archive-summary.json": `${JSON.stringify(payload, null, 2)}\n`,
      "archive/index.html": archiveHtml,
    },
  };

}

export async function buildArchiveSummary({ root = repoRoot, library = contentLibrary, check = false } = {}) {
  const result = await renderArchiveSummary({ root, library });
  const stale = [];
  for (const [file, expected] of Object.entries(result.outputs)) {
    let saved;
    try { saved = await readFile(path.join(root, file), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (saved !== expected) stale.push(file);
  }
  if (!check) for (const file of stale) {
    await writeFile(path.join(root, file), result.outputs[file]);
  }
  return { counts: result.counts, stale, check };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--check", "--write"].includes(arg))
      || (args.includes("--check") && args.includes("--write"))) {
    throw new Error("Usage: node scripts/build-archive-summary.mjs [--check|--write]");
  }
  const result = await buildArchiveSummary({ check: args.includes("--check") });
  console.log(`public archive summary: ${result.counts.publicSeries} series, ${result.counts.publishedPosts} posts, ${result.counts.manifestSources} manifest sources, ${result.counts.presentationArchiveItems} presentation archive items`);
  if (result.check && result.stale.length) {
    console.error(`stale archive output: ${result.stale.join(", ")}`);
    process.exitCode = 1;
  }
}
