#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentLibrary } from "../assets/content-manifest.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const series = contentLibrary.series;
const posts = series.flatMap((entry) => entry.posts ?? []);
const sources = series.flatMap((entry) => entry.sources ?? []);

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
    label: entry.label,
    title: entry.title,
    href: entry.href,
    posts: (entry.posts ?? []).length,
    sources: (entry.sources ?? []).length,
    hasCover: Boolean(entry.cover),
  })),
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
await writeFile(archivePath, archiveHtml);

console.log(
  `public archive summary: ${payload.counts.publicSeries} series, `
    + `${payload.counts.publishedPosts} posts, `
    + `${payload.counts.manifestSources} manifest sources, `
    + `${payload.counts.presentationArchiveItems} presentation archive items`,
);
