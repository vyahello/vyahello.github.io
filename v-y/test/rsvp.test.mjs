/* ============================================================
   test/rsvp.test.mjs — unit tests for pure helpers in rsvp.js
   Run with:  node test/rsvp.test.mjs
   (Direct file path — `node --test test/` hits a Node 22.22.2 glob bug.)
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseAttendance,
  sanitizeGuestNames,
  buildPayload,
  MAX_GUESTS,
} from '../js/rsvp.js';

/* ---- parseAttendance ---- */

test('parseAttendance: yes / maybe / no pass through', () => {
  assert.equal(parseAttendance('yes'),   'yes');
  assert.equal(parseAttendance('maybe'), 'maybe');
  assert.equal(parseAttendance('no'),    'no');
});

test('parseAttendance: case-insensitive + trims', () => {
  assert.equal(parseAttendance('YES'),    'yes');
  assert.equal(parseAttendance('  Maybe '), 'maybe');
  assert.equal(parseAttendance('NO\n'),    'no');
});

test('parseAttendance: invalid input → null', () => {
  assert.equal(parseAttendance(''),         null);
  assert.equal(parseAttendance('bogus'),    null);
  assert.equal(parseAttendance(null),       null);
  assert.equal(parseAttendance(undefined),  null);
  assert.equal(parseAttendance(42),         null);
});

/* ---- sanitizeGuestNames ---- */

test('sanitizeGuestNames: trims + drops blanks', () => {
  assert.deepEqual(
    sanitizeGuestNames(['Олена', '  Петро  ', '', '   ', 'Анна']),
    ['Олена', 'Петро', 'Анна'],
  );
});

test(`sanitizeGuestNames: clamps to MAX_GUESTS (${'placeholder'})`, () => {
  // Reference the actual MAX_GUESTS so the test doesn't drift if the cap changes.
  const big = Array.from({ length: MAX_GUESTS + 5 }, (_, i) => `Гість ${i}`);
  const out = sanitizeGuestNames(big);
  assert.equal(out.length, MAX_GUESTS);
});

test('sanitizeGuestNames: non-array input → []', () => {
  assert.deepEqual(sanitizeGuestNames(null),      []);
  assert.deepEqual(sanitizeGuestNames(undefined), []);
  assert.deepEqual(sanitizeGuestNames('abc'),     []);
  assert.deepEqual(sanitizeGuestNames(123),       []);
});

test('sanitizeGuestNames: non-string entries are dropped', () => {
  assert.deepEqual(sanitizeGuestNames(['Olena', 5, null, 'Petro']),
                   ['Olena', 'Petro']);
});

/* ---- buildPayload ---- */

test('buildPayload: yes preserves guest_names + wishes + identity', () => {
  const p = buildPayload({
    slug:        'iryna-volodymyr',
    displayName: 'Ірина та Володимир',
    attending:   'yes',
    guestNames:  ['Ірина', '  Володимир '],
    wishes:      '  усього найкращого  ',
  });
  assert.equal(p.slug,         'iryna-volodymyr');
  assert.equal(p.display_name, 'Ірина та Володимир');
  assert.equal(p.attending, 'yes');
  assert.deepEqual(p.guest_names, ['Ірина', 'Володимир']);
  assert.equal(p.wishes, 'усього найкращого');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(p.submitted_at));
});

test('buildPayload: no empties guest_names but keeps wishes', () => {
  const p = buildPayload({
    attending:  'no',
    guestNames: ['ignored'],
    wishes:     'на жаль не зможу',
  });
  assert.equal(p.attending, 'no');
  assert.deepEqual(p.guest_names, []);
  assert.equal(p.wishes, 'на жаль не зможу');
});

test('buildPayload: maybe keeps guest_names', () => {
  const p = buildPayload({
    attending:  'maybe',
    guestNames: ['Олена'],
    wishes:     '',
  });
  assert.equal(p.attending, 'maybe');
  assert.deepEqual(p.guest_names, ['Олена']);
  assert.equal(p.wishes, '');
});

test('buildPayload: guest_names array is a copy, not a live ref', () => {
  const names = ['Олена'];
  const p = buildPayload({ attending: 'yes', guestNames: names, wishes: '' });
  names.push('Петро');
  assert.deepEqual(p.guest_names, ['Олена']);
});

test('buildPayload: invalid attending becomes null (guest_names preserved)', () => {
  const p = buildPayload({ attending: 'bogus', guestNames: ['Олена'], wishes: '' });
  assert.equal(p.attending, null);
  assert.deepEqual(p.guest_names, ['Олена']);
});

test('buildPayload: missing state fields default safely', () => {
  const p = buildPayload({});
  assert.equal(p.attending,    null);
  assert.deepEqual(p.guest_names, []);
  assert.equal(p.wishes,       '');
  assert.equal(p.slug,         null);
  assert.equal(p.display_name, null);
});

test('buildPayload: passes through submittedAt for edit/upsert', () => {
  const ts = '2026-06-01T10:00:00.000Z';
  const p = buildPayload({ attending: 'yes', guestNames: ['Олена'], submittedAt: ts });
  assert.equal(p.submitted_at, ts);
});
