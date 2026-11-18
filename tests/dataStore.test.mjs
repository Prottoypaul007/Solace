import assert from 'node:assert/strict';
import test from 'node:test';
import { readList, writeBatch, writeList } from '../services/dataStore.ts';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

test('save is readable and corrupt data is preserved', () => {
  values.clear();
  writeList('records', [{ id: 'one' }]);
  assert.deepEqual(readList('records'), [{ id: 'one' }]);
  values.set('records', '{bad');
  assert.throws(() => readList('records'), /could not be read/);
  assert.equal(values.get('records'), '{bad');
});

test('failed batch save restores prior values', () => {
  values.clear();
  values.set('students', '[{"id":"old"}]');
  values.set('classes', '[]');
  const original = localStorage.setItem;
  let failed = false;
  localStorage.setItem = (key, value) => {
    if (key === 'classes' && !failed) { failed = true; throw new Error('quota'); }
    original(key, value);
  };
  try {
    assert.throws(() => writeBatch({ students: [{ id: 'new' }], classes: [{ id: 'class' }] }), /previous records were kept/);
    assert.equal(values.get('students'), '[{"id":"old"}]');
    assert.equal(values.get('classes'), '[]');
  } finally { localStorage.setItem = original; }
});
