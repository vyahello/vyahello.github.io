/* ============================================================
   test/guest.test.mjs — unit tests for pure helpers in guest.js
   Run with:  node test/guest.test.mjs
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getGuestSlug } from '../js/guest.js';

test('getGuestSlug: returns null when no ?g=', () => {
  assert.equal(getGuestSlug(''),               null);
  assert.equal(getGuestSlug('?foo=bar'),       null);
  assert.equal(getGuestSlug('?guest=Olena'),   null);  // legacy param, not ?g=
});

test('getGuestSlug: valid kebab-case slug passes', () => {
  assert.equal(getGuestSlug('?g=iryna-volodymyr'),       'iryna-volodymyr');
  assert.equal(getGuestSlug('?g=olena'),                  'olena');
  assert.equal(getGuestSlug('?g=family-shevchenko-2026'), 'family-shevchenko-2026');
});

test('getGuestSlug: trims whitespace + lowercases', () => {
  assert.equal(getGuestSlug('?g=  OLENA  '), 'olena');
  assert.equal(getGuestSlug('?g=Iryna-Volodymyr'), 'iryna-volodymyr');
});

test('getGuestSlug: rejects invalid characters (underscores, spaces, cyrillic, special)', () => {
  assert.equal(getGuestSlug('?g=olena_petrenko'),  null);  // underscore not allowed
  assert.equal(getGuestSlug('?g=olena petrenko'),  null);  // space not allowed
  assert.equal(getGuestSlug('?g=Олена'),           null);  // non-ASCII
  assert.equal(getGuestSlug('?g=olena!'),          null);  // special char
  assert.equal(getGuestSlug('?g='),                null);  // empty value
});

test('getGuestSlug: combined params still pick out g', () => {
  assert.equal(getGuestSlug('?theme=cream&g=olena&skipIntro=1'), 'olena');
});
