import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { contentLibrary } from '../assets/content-manifest.js';
import { buildArchiveSummary, renderArchiveSummary } from '../scripts/build-archive-summary.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputFiles = ['assets/archive-summary.json', 'archive/index.html'];
const inputFiles = ['assets/content-manifest.js', 'series/metaverse-era/sources/presentations/index.html'];
const readOutputs = (root) => Promise.all(outputFiles.map((file) => readFile(path.join(root, file), 'utf8')));
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'klu-archive-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of [...inputFiles, ...outputFiles]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await copyFile(path.join(repo, file), path.join(root, file));
  }
  return root;
}

test('saved archive outputs match actual inputs, not only each other', async () => {
  const result = await buildArchiveSummary({ check: true });
  assert.deepEqual(result.stale, []);
  const summary = JSON.parse((await renderArchiveSummary()).outputs[outputFiles[0]]);
  assert.equal(Object.hasOwn(summary, 'asOf'), false, 'a fixed date must not pretend to measure freshness');
  for (const file of inputFiles) {
    const hash = createHash('sha256').update(await readFile(path.join(repo, file))).digest('hex');
    assert.equal(summary.inputSha256[file], hash);
  }
});

test('check detects stale output without repairing or overwriting it', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, outputFiles[0]), '{"stale":true}\n');
  const before = await readOutputs(root);
  const result = await buildArchiveSummary({ root, check: true });
  assert.deepEqual(result.stale, [outputFiles[0]]);
  assert.deepEqual(await readOutputs(root), before);
  assert.deepEqual((await buildArchiveSummary({ root })).stale, [outputFiles[0]]);
  const generated = await readOutputs(root);
  assert.deepEqual((await buildArchiveSummary({ root })).stale, []);
  assert.deepEqual(await readOutputs(root), generated);
});

test('changing an input is distinguishable even when the displayed counts stay equal', async (t) => {
  const root = await fixture(t), file = path.join(root, inputFiles[0]);
  await writeFile(file, `${await readFile(file, 'utf8')}\n`);
  const result = await buildArchiveSummary({ root, check: true });
  assert.deepEqual(result.stale, [outputFiles[0]]);
  assert.equal(result.counts.manifestSources, contentLibrary.series.flatMap((s) => s.sources).length);
});

test('new manifest sources are registered without changing the generator', async (t) => {
  const root = await fixture(t), library = structuredClone(contentLibrary);
  const source = { ...library.series[0].sources[0], id: 'synthetic-extra', href: 'series/life-universe/sources/synthetic-extra/' };
  library.series[0].sources.push(source);
  const result = await renderArchiveSummary({ root, library });
  const summary = JSON.parse(result.outputs[outputFiles[0]]);
  assert.equal(summary.counts.manifestSources, contentLibrary.series.flatMap((s) => s.sources).length + 1);
  assert.equal(summary.registeredSources.at(1).id, source.id);
  assert.match(result.outputs[outputFiles[1]], /data-source-key="life-universe:synthetic-extra"/);
});

test('missing identity, duplicate identity or destination cannot partially replace outputs', async (t) => {
  const root = await fixture(t), before = await readOutputs(root);
  for (const variant of ['missing', 'identity', 'destination']) {
    const library = structuredClone(contentLibrary), sources = library.series[0].sources;
    if (variant === 'missing') delete sources[0].id;
    else sources.push({ ...sources[0], id: variant === 'destination' ? 'different-id' : sources[0].id });
    await assert.rejects(buildArchiveSummary({ root, library }), /identity is missing or duplicated/);
    assert.deepEqual(await readOutputs(root), before);
  }
});

test('invalid markup and legacy duplicate row fail before any output is written', async (t) => {
  const root = await fixture(t), file = path.join(root, outputFiles[1]);
  const original = await readFile(file, 'utf8');
  for (const variant of ['missing-marker', 'duplicate-row', 'missing-index']) {
    let html = original;
    if (variant === 'missing-marker') html = html.replace('ARCHIVE_REGISTERED_SOURCES:START', 'REMOVED');
    if (variant === 'duplicate-row') html = html.replace('<!-- ARCHIVE_REGISTERED_SOURCES:END -->', '<!-- ARCHIVE_REGISTERED_SOURCES:END --><div class="arc-stock__row" data-access="open"><a href="../series/metaverse-era/sources/presentations/">synthetic</a></div>');
    await writeFile(file, html);
    if (variant === 'missing-index') await writeFile(path.join(root, inputFiles[1]), '<main>No index</main>');
    const before = await readOutputs(root);
    await assert.rejects(buildArchiveSummary({ root }), /block missing|exactly one inventory row|entries are missing/);
    assert.deepEqual(await readOutputs(root), before);
  }
});

test('CLI check and invalid arguments are non-writing modes', async () => {
  const before = await readOutputs(repo);
  const checked = spawnSync(process.execPath, ['scripts/build-archive-summary.mjs', '--check'], { cwd: repo, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const invalid = spawnSync(process.execPath, ['scripts/build-archive-summary.mjs', '--chek'], { cwd: repo, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage:/);
  assert.deepEqual(await readOutputs(repo), before);
});
