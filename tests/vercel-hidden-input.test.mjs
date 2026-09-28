import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'series/manifest.json'), 'utf8'));
const rules = readFileSync(resolve(root, '.vercelignore'), 'utf8')
  .split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

test('the Vercel input excludes exactly the review-only series and previews', () => {
  const hidden = manifest.series.filter((series) => series.public === false);
  assert.equal(hidden.length, 3, 'a changed hidden-series set needs a new release review');
  const intended = new Set(hidden.map((series) => `series/${series.slug}/`));
  intended.add('previews/');
  const actual = rules.filter((rule) => rule.startsWith('series/') || rule === 'previews/');
  assert.deepEqual(new Set(actual), intended);
  assert.equal(actual.length, intended.size, 'duplicate ignore rules can conceal a release edit');

  for (const series of hidden) {
    assert.ok(statSync(resolve(root, `series/${series.slug}/index.html`)).isFile());
  }
  assert.ok(statSync(resolve(root, 'previews/series-00-08/index.html')).isFile());
  for (const series of manifest.series.filter((entry) => entry.public === true)) {
    assert.ok(!intended.has(`series/${series.slug}/`), series.slug);
    assert.ok(statSync(resolve(root, `series/${series.slug}/index.html`)).isFile());
  }
  assert.ok(statSync(resolve(root, 'api/xai-client-secret.js')).isFile());
});
