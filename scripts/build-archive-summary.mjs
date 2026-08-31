#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentLibrary } from "../assets/content-manifest.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cleanText = (value) => String(value ?? "").replaceAll("\u2014", "·");

const series = contentLibrary.series;
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
  path.join(repoRoot, presentationArchiveHref, "index.html"),
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
  asOf: "2026-08-31",
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

await writeFile(
  path.join(repoRoot, "assets/archive-summary.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
);

const archivePath = path.join(repoRoot, "archive/index.html");
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
  const meta = [source.seriesLabel, sourceLabel, published]
    .filter(Boolean)
    .join(" · ");
  const sourceKey = `${source.seriesSlug}:${source.id}`;
  return `        <div class="arc-stock__row" data-access="open" data-source-key="${escapeHtml(sourceKey)}" data-title="${escapeHtml(source.displayTitle)}" data-meta="${escapeHtml(meta)}" data-description="${escapeHtml(description)}"><dt><span class="arc-stock__status">열람 가능</span><a class="arc-stock__link" href="../${escapeHtml(source.href)}"><span class="arc-stock__title">${escapeHtml(source.displayTitle)}</span><span class="arc-stock__action"><svg class="klu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="../assets/icons/klu-interface-icons.svg#arrow-right"></use></svg><span class="arc-stock__action-label">자료 보기</span></span></a></dt><dd><span class="arc-stock__meta">${escapeHtml(meta)}</span><span class="arc-stock__description">${escapeHtml(description)}</span></dd></div>`;
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
await writeFile(archivePath, archiveHtml);

console.log(
  `public archive summary: ${payload.counts.publicSeries} series, `
    + `${payload.counts.publishedPosts} posts, `
    + `${payload.counts.manifestSources} manifest sources, `
    + `${payload.counts.presentationArchiveItems} presentation archive items`,
);
