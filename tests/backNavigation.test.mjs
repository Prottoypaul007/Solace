import test from 'node:test';
import assert from 'node:assert/strict';
import { backFallback } from '../components/backNavigation.ts';

test('directly opened screens have a useful back destination', () => {
  const tutorRoutes = {
    '/students': '/',
    '/add-student': '/students',
    '/student/123': '/students',
    '/student/123/tests': '/student/123',
    '/student/123/parents': '/student/123',
    '/student/123/messages': '/student/123',
    '/student/123/statement': '/student/123',
    '/account': '/settings',
    '/student-accounts': '/settings',
    '/settings': '/',
    '/connect': '/',
  };
  for (const [path, expected] of Object.entries(tutorRoutes)) {
    assert.equal(backFallback(path, false), expected, path);
  }
  assert.equal(backFallback('/connect', true), '/student-home');
  assert.equal(backFallback('/student-account', true), '/student-home');
});
