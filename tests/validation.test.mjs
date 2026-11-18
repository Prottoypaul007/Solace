import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTestMarks } from '../services/validation.ts';

test('test marks accept zero and reject impossible scores', () => {
  assert.doesNotThrow(() => validateTestMarks(100, 0));
  assert.doesNotThrow(() => validateTestMarks(100, 100));
  assert.throws(() => validateTestMarks(0, 0), /maximum/);
  assert.throws(() => validateTestMarks(50, 51), /maximum/);
  assert.throws(() => validateTestMarks(50, -1), /maximum/);
});
