/* ============================================================
   test/rsvp.test.mjs — unit tests for pure helpers in rsvp.js
   Run with:  node --test test/
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeStepFlow, clampSeats, buildPayload } from '../js/rsvp.js';

test('computeStepFlow: null returns only the first step', () => {
  assert.deepEqual(computeStepFlow(null), [0]);
});

test('computeStepFlow: attending true walks all five steps in order', () => {
  assert.deepEqual(computeStepFlow(true), [0, 1, 2, 3, 4]);
});

test('computeStepFlow: attending false skips seats + food', () => {
  assert.deepEqual(computeStepFlow(false), [0, 3, 4]);
});

test('clampSeats: clamps below 1 to 1', () => {
  assert.equal(clampSeats(0),  1);
  assert.equal(clampSeats(-5), 1);
});

test('clampSeats: clamps above 10 to 10', () => {
  assert.equal(clampSeats(11),   10);
  assert.equal(clampSeats(9999), 10);
});

test('clampSeats: in-range values pass through (rounded)', () => {
  assert.equal(clampSeats(1),   1);
  assert.equal(clampSeats(5),   5);
  assert.equal(clampSeats(10),  10);
  assert.equal(clampSeats(3.4), 3);
  assert.equal(clampSeats(3.6), 4);
});

test('clampSeats: non-numeric falls back to default (2)', () => {
  assert.equal(clampSeats('abc'),       2);
  assert.equal(clampSeats(undefined),   2);
  assert.equal(clampSeats(NaN),         2);
});

test('buildPayload: attending true preserves seats + food + wishes', () => {
  const p = buildPayload({
    guestId:   'ivan-petrov',
    name:      'Іван',
    attending: true,
    seats:     3,
    food:      ['meat', 'fish'],
    allergies: 'без горіхів',
    wishes:    'усього найкращого',
  });
  assert.equal(p.guest_id, 'ivan-petrov');
  assert.equal(p.name, 'Іван');
  assert.equal(p.attending, true);
  assert.equal(p.seats, 3);
  assert.deepEqual(p.food, ['meat', 'fish']);
  assert.equal(p.allergies, 'без горіхів');
  assert.equal(p.wishes, 'усього найкращого');
  // submitted_at is an ISO string
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(p.submitted_at));
});

test('buildPayload: attending false zeros out seats/food/allergies but keeps wishes', () => {
  const p = buildPayload({
    attending: false,
    seats:     5,                // should be ignored
    food:      ['meat'],         // should be ignored
    allergies: 'без горіхів',    // should be ignored
    wishes:    'на жаль не зможу',
  });
  assert.equal(p.attending, false);
  assert.equal(p.seats, 0);
  assert.deepEqual(p.food, []);
  assert.equal(p.allergies, '');
  assert.equal(p.wishes, 'на жаль не зможу');
});

test('buildPayload: null guest fields stay null (Stage 7 fills them)', () => {
  const p = buildPayload({ attending: true, seats: 2, food: [], wishes: '' });
  assert.equal(p.guest_id, null);
  assert.equal(p.name, null);
});

test('buildPayload: food array is a copy, not a reference', () => {
  const food = ['meat'];
  const p = buildPayload({ attending: true, seats: 2, food, wishes: '' });
  food.push('fish');
  assert.deepEqual(p.food, ['meat']);
});
