export function backFallback(path: string, studentMode: boolean): string {
  if (path === '/student-account') return '/student-home';
  if (path === '/account' || path === '/student-accounts') return '/settings';
  if (path === '/add-student' || path === '/student') return '/students';
  if (path === '/students') return '/';
  if (path.startsWith('/student/')) {
    const match = path.match(/^\/student\/([^/]+)\//);
    return match ? `/student/${match[1]}` : '/students';
  }
  return studentMode ? '/student-home' : '/';
}
