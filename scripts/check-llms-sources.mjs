#!/usr/bin/env node
// Read-only consistency check. Display metadata is not publication permission.
// Authority follows the existing agent-surface generator: source allowedTargets,
// or registry.sources when a public series has no assistant context.
// Legacy sources backed by that authority, the map and the citation contract stay.
// Intentional differences require a separately approved exception proposal;
// this tool never accepts exceptions, changes permission, or writes an output.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentLibrary } from "../assets/content-manifest.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sourcePattern = /^\/series\/([a-z0-9-]+)\/sources\/([a-z0-9-]+)\/$/;
const requireArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};
const uniqueSet = (values, label) => {
  const result = new Set(values);
  if (result.size !== values.length) throw new Error(`${label} contains duplicates`);
  return result;
};
const slug = (value) => {
  if (typeof value !== "string" || !slugPattern.test(value)) throw new Error("Invalid source identity");
  return value;
};

export function inspectLlmsSources({ library, registry, contract, llms, contexts = {}, existingSources }) {
  const map = new URL(contract.map);
  if (map.protocol !== "https:") throw new Error("The map must use HTTPS");
  const base = map.origin;
  const canonicalUrl = (value) => {
    const url = new URL(value);
    if (url.origin !== base || url.search || url.hash || url.href !== value) {
      throw new Error("Noncanonical or external surface URL");
    }
    return value;
  };
  const sourceUrl = (series, id) => `${base}/series/${slug(series)}/sources/${slug(id)}/`;
  const isSource = (url) => sourcePattern.test(new URL(url).pathname);
  const series = requireArray(registry.series, "registry.series");
  uniqueSet(series.map((entry) => slug(entry.slug)), "Series identities");
  const publicSeries = new Set(series.filter((entry) => entry.public === true).map((entry) => entry.slug));
  const authority = [];
  for (const entry of series.filter((item) => item.public === true)) {
    const context = contexts[entry.slug];
    const ids = context == null
      ? requireArray(entry.sources ?? [], "registry.sources")
      : requireArray(context.allowedTargets, "allowedTargets")
        .filter((target) => target.contentType === "source").map((target) => target.contentId);
    authority.push(...ids.map((id) => sourceUrl(entry.slug, id)));
  }
  const authorized = uniqueSet(authority, "Source authority");
  const displayed = [];
  for (const entry of requireArray(library.series, "library.series")) {
    if (!publicSeries.has(entry.slug)) throw new Error("Display series lacks a public registry declaration");
    for (const source of requireArray(entry.sources ?? [], "library.sources")) {
      const url = sourceUrl(entry.slug, source.id);
      if (source.href !== new URL(url).pathname.slice(1)) throw new Error("Source identity and href disagree");
      displayed.push(url);
    }
  }
  const display = uniqueSet(displayed, "Displayed sources");
  const listed = uniqueSet([...llms.matchAll(/^- \[[^\n]+?\]\(([^)]+)\)/gm)]
    .map((match) => canonicalUrl(match[1])), "LLM map");
  const cited = uniqueSet(requireArray(contract.quotable?.surfaces, "quotable.surfaces")
    .map(canonicalUrl), "Citation surfaces");
  if (!listed.size || !cited.size) throw new Error("Surface lists must not be empty");
  const listedSources = new Set([...listed].filter(isSource));
  const citedSources = new Set([...cited].filter(isSource));
  const problems = [];
  for (const url of new Set([...listed, ...cited])) {
    if (listed.has(url) !== cited.has(url)) problems.push({ code: "map-contract-drift", url });
  }
  const retainedLegacySources = [];
  for (const url of new Set([...display, ...authorized, ...listedSources, ...citedSources])) {
    const missing = [];
    if (!authorized.has(url)) missing.push("source-authority");
    if (!listedSources.has(url)) missing.push("llms");
    if (!citedSources.has(url)) missing.push("citation-contract");
    if (missing.length) problems.push({ code: "source-consistency-gap", url, missing });
    else if (!display.has(url)) retainedLegacySources.push(url);
    if (existingSources && existingSources[url] !== true) problems.push({ code: "source-file-missing", url });
  }
  return {
    status: problems.length ? "blocked" : "aligned",
    counts: { display: display.size, authority: authorized.size, llms: listedSources.size,
      citation: citedSources.size, retainedLegacy: retainedLegacySources.length },
    retainedLegacySources,
    problems,
    changesApplied: false,
    permissionPromoted: false,
  };
}

export async function checkLlmsSources({ root = repoRoot, library = contentLibrary } = {}) {
  const json = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
  const registry = await json("series/manifest.json");
  const contract = await json("agent/citation-contract.json");
  const llms = await readFile(path.join(root, "llms.txt"), "utf8");
  const contexts = {};
  for (const series of requireArray(registry.series, "registry.series").filter((entry) => entry.public === true)) {
    slug(series.slug);
    try { contexts[series.slug] = await json(`series/${series.slug}/assistant/context.json`); }
    catch (error) { if (error.code !== "ENOENT") throw error; contexts[series.slug] = null; }
  }
  const input = { library, registry, contract, llms, contexts };
  const result = inspectLlmsSources(input);
  const urls = new Set([...result.problems.map((item) => item.url), ...result.retainedLegacySources]);
  for (const series of library.series) for (const source of series.sources ?? []) {
    urls.add(new URL(source.href, contract.map).href);
  }
  const existingSources = {};
  for (const url of urls) {
    const pathname = new URL(url).pathname;
    if (!sourcePattern.test(pathname)) continue;
    try { existingSources[url] = (await stat(path.join(root, pathname.slice(1), "index.html"))).isFile(); }
    catch (error) { if (error.code !== "ENOENT") throw error; existingSources[url] = false; }
  }
  return inspectLlmsSources({ ...input, existingSources });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes("--check") || args.some((arg) => !["--check", "--json"].includes(arg))
        || new Set(args).size !== args.length) throw new Error("Usage: node scripts/check-llms-sources.mjs --check [--json]");
    const result = await checkLlmsSources();
    if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`LLM sources: ${result.status}; display=${result.counts.display}, authority=${result.counts.authority}, map=${result.counts.llms}, citation=${result.counts.citation}, legacy=${result.counts.retainedLegacy}`);
      for (const problem of result.problems) console.error(`${problem.code}: ${problem.url}${problem.missing ? ` (${problem.missing.join(", ")})` : ""}`);
    }
    process.exitCode = result.problems.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
