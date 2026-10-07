import assert from "node:assert/strict";
import { readFile, stat, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectLlmsSources, checkLlmsSources } from "../scripts/check-llms-sources.mjs";
import { contentLibrary } from "../assets/content-manifest.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (id) => ({ id, href: `series/sample/sources/${id}/` });
const url = (id) => `https://example.invalid/series/sample/sources/${id}/`;
function fixture() {
  return {
    library: { series: [{ slug: "sample", sources: [source("one")] }] },
    registry: { series: [{ slug: "sample", public: true, sources: ["one"] }] },
    contexts: {},
    contract: { map: "https://example.invalid/llms.txt", quotable: { surfaces: [url("one")] } },
    llms: `- [One](${url("one")}): Existing public metadata.\n`,
  };
}

test("matching display, permission, map and citation sets pass without changes", () => {
  const input = fixture(), before = JSON.stringify(input), result = inspectLlmsSources(input);
  assert.equal(result.status, "aligned");
  assert.deepEqual(result.problems, []);
  assert.equal(result.changesApplied, false);
  assert.equal(result.permissionPromoted, false);
  assert.equal(JSON.stringify(input), before);
});

test("display-only sources fail closed instead of becoming permission", () => {
  const input = fixture();
  input.library.series[0].sources.push(source("two"));
  const result = inspectLlmsSources(input);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.problems, [{ code: "source-consistency-gap", url: url("two"),
    missing: ["source-authority", "llms", "citation-contract"] }]);
});

test("assistant allowedTargets override registry fallback and retain approved legacy entries", () => {
  const input = fixture();
  input.registry.series[0].sources.push("not-authorized");
  input.contexts.sample = { allowedTargets: [
    { contentType: "source", contentId: "one" }, { contentType: "source", contentId: "legacy" },
    { contentType: "post", contentId: "not-a-source" },
  ] };
  input.contract.quotable.surfaces.push(url("legacy"));
  input.llms += `- [Legacy](${url("legacy")}): Existing entry.\n`;
  const result = inspectLlmsSources(input);
  assert.equal(result.status, "aligned");
  assert.deepEqual(result.retainedLegacySources, [url("legacy")]);
  assert.equal(result.counts.authority, 2);
});

test("extra map and citation entries without source authority are not auto-accepted", () => {
  const input = fixture();
  input.contract.quotable.surfaces.push(url("unknown"));
  input.llms += `- [Unknown](${url("unknown")}): Not approved.\n`;
  assert.deepEqual(inspectLlmsSources(input).problems, [{ code: "source-consistency-gap", url: url("unknown"), missing: ["source-authority"] }]);
});

test("missing map entry and map/contract disagreement are detected separately", () => {
  const input = fixture();
  input.llms = "- [Series](https://example.invalid/series/sample/): Series.\n";
  const result = inspectLlmsSources(input);
  assert.equal(result.status, "blocked");
  assert.ok(result.problems.some((p) => p.code === "map-contract-drift"));
  assert.ok(result.problems.some((p) => p.code === "source-consistency-gap" && p.missing.includes("llms")));
});

test("malformed context, duplicate URLs and identity/path disagreements fail as input errors", () => {
  for (const mode of ["context", "duplicate-map", "duplicate-contract", "identity", "external"]) {
    const input = fixture();
    if (mode === "context") input.contexts.sample = {};
    if (mode === "duplicate-map") input.llms += input.llms;
    if (mode === "duplicate-contract") input.contract.quotable.surfaces.push(url("one"));
    if (mode === "identity") input.library.series[0].sources[0].href = "../escape/";
    if (mode === "external") input.contract.quotable.surfaces[0] = "https://elsewhere.invalid/";
    assert.throws(() => inspectLlmsSources(input), undefined, mode);
  }
});

test("an existing null context cannot fall back to registry permission", () => {
  const input = fixture();
  for (const context of [null, false, 0, "", []]) {
    input.contexts.sample = context;
    assert.throws(() => inspectLlmsSources(input), /existing assistant context/);
  }
  delete input.contexts.sample;
  assert.equal(inspectLlmsSources(input).status, "aligned");
});

test("loader distinguishes a missing context file from a file containing null", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "llms-context-canary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = fixture();
  await mkdir(path.join(directory, "series/sample/sources/one"), { recursive: true });
  await mkdir(path.join(directory, "agent"));
  await writeFile(path.join(directory, "series/manifest.json"), JSON.stringify(input.registry));
  await writeFile(path.join(directory, "agent/citation-contract.json"), JSON.stringify(input.contract));
  await writeFile(path.join(directory, "llms.txt"), input.llms);
  await writeFile(path.join(directory, "series/sample/sources/one/index.html"), "synthetic");
  assert.equal((await checkLlmsSources({ root: directory, library: input.library })).status, "aligned");
  await mkdir(path.join(directory, "series/sample/assistant"));
  const contextPath = path.join(directory, "series/sample/assistant/context.json");
  await writeFile(contextPath, "null\n");
  await assert.rejects(checkLlmsSources({ root: directory, library: input.library }), /existing assistant context/);
  assert.equal(await readFile(contextPath, "utf8"), "null\n");
});

test("malformed surface entries are rejected instead of silently skipped", () => {
  for (const suffix of [
    `- [Two](${url("two")}\n`,
    `- [Two] ${url("two")}\n`,
    `  - [Two](${url("two")}): indented\n`,
    `* [Two](${url("two")}): different prefix\n`,
  ]) {
    const input = fixture();
    input.llms += suffix;
    assert.throws(() => inspectLlmsSources(input), /Malformed LLM surface entry/);
  }
});

test("map and surface URL credentials never enter an aligned result", () => {
  const mapInput = fixture();
  mapInput.contract.map = "https://synthetic:canary@example.invalid/llms.txt";
  assert.throws(() => inspectLlmsSources(mapInput), /without credentials/);
  const input = fixture(), credentialUrl = "https://synthetic:canary@example.invalid/series/sample/";
  input.contract.quotable.surfaces.push(credentialUrl);
  input.llms += `- [Series](${credentialUrl}): credential canary\n`;
  assert.throws(() => inspectLlmsSources(input), /Noncanonical or external surface URL/);
});

test("source-like paths cannot bypass source checks by encoding or dropping the slash", () => {
  for (const pathname of [
    "/series/sample/sources/two",
    "/series/sample/sources/%6fne/",
    "/series/sample/%73ources/one/",
    "/series/sample/sources/",
  ]) {
    const input = fixture(), malformedUrl = `https://example.invalid${pathname}`;
    input.contract.quotable.surfaces.push(malformedUrl);
    input.llms += `- [Source](${malformedUrl}): path canary\n`;
    assert.throws(() => inspectLlmsSources(input), /Noncanonical source surface path/);
  }
});

test("other canonical non-source surfaces keep the existing contract boundary", () => {
  const input = fixture(), anotherSurface = "https://example.invalid/series/sample/posts/one/";
  input.contract.quotable.surfaces.push(anotherSurface);
  input.llms += `- [Post](${anotherSurface}): already declared\n`;
  assert.equal(inspectLlmsSources(input).status, "aligned");
});

test("hidden series cannot acquire source authority or enter the display registry", () => {
  const input = fixture();
  input.registry.series[0].public = false;
  assert.throws(() => inspectLlmsSources(input), /public registry declaration/);
});

test("known source permission does not hide a missing local page", () => {
  const input = fixture();
  input.existingSources = { [url("one")]: false };
  assert.deepEqual(inspectLlmsSources(input).problems, [{ code: "source-file-missing", url: url("one") }]);
});

test("repository checks use current inputs rather than frozen source counts", async () => {
  const result = await checkLlmsSources();
  const contract = JSON.parse(await readFile(path.join(root, "agent/citation-contract.json"), "utf8"));
  const llms = await readFile(path.join(root, "llms.txt"), "utf8");
  const displayed = contentLibrary.series.flatMap((series) => series.sources ?? [])
    .map((source) => new URL(source.href, contract.map).href);
  const cited = contract.quotable.surfaces.filter((surface) => surface.includes("/sources/"));
  const listed = [...llms.matchAll(/^- \[[^\n]+?\]\(([^)]+)\)/gm)]
    .map((match) => match[1]).filter((surface) => surface.includes("/sources/"));
  assert.equal(result.counts.display, displayed.length);
  assert.equal(result.counts.llms, listed.length);
  assert.equal(result.counts.citation, cited.length);
  for (const surface of displayed.filter((item) => !cited.includes(item))) {
    assert.ok(result.problems.some((problem) => problem.url === surface
      && problem.missing?.includes("citation-contract")), surface);
  }
  assert.equal(result.status, result.problems.length ? "blocked" : "aligned");
  for (const surface of result.retainedLegacySources) {
    assert.ok(listed.includes(surface) && cited.includes(surface));
    assert.ok(!displayed.includes(surface));
  }
  assert.equal(result.permissionPromoted, false);
});

test("CLI check and rejected write flags leave public outputs untouched", async () => {
  const files = ["llms.txt", "agent/citation-contract.json", "series/manifest.json", "assets/content-manifest.js"];
  const snapshot = async () => Promise.all(files.map(async (file) => ({
    bytes: await readFile(path.join(root, file), "utf8"),
    mtime: (await stat(path.join(root, file), { bigint: true })).mtimeNs.toString(),
  })));
  const before = await snapshot();
  const expected = await checkLlmsSources();
  const checked = spawnSync(process.execPath, ["scripts/check-llms-sources.mjs", "--check", "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(checked.status, expected.problems.length ? 1 : 0);
  assert.deepEqual(JSON.parse(checked.stdout), expected);
  for (const args of [["--write"], ["--check", "--write"], ["--check", "--accept"], ["--check", "--check"]]) {
    const result = spawnSync(process.execPath, ["scripts/check-llms-sources.mjs", ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 2);
  }
  assert.deepEqual(await snapshot(), before);
});
