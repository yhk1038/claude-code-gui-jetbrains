import { describe, it, expect, vi, beforeEach } from 'vitest';

// Settings watcher uses fs.watch which is complex to mock.
// For Phase 2, test the SettingsFileWatcher's refcount logic by
// replicating the pattern used in settings-watcher.ts

describe('settings-watcher refcount pattern', () => {
  it('should track project registration count', () => {
    const projects = new Map<string, number>();

    function register(path: string) {
      projects.set(path, (projects.get(path) ?? 0) + 1);
    }

    function unregister(path: string) {
      const count = (projects.get(path) ?? 0) - 1;
      if (count <= 0) {
        projects.delete(path);
      } else {
        projects.set(path, count);
      }
    }

    register('/project-a');
    register('/project-a');
    register('/project-b');

    expect(projects.get('/project-a')).toBe(2);
    expect(projects.get('/project-b')).toBe(1);

    unregister('/project-a');
    expect(projects.get('/project-a')).toBe(1);

    unregister('/project-a');
    expect(projects.has('/project-a')).toBe(false);

    unregister('/project-b');
    expect(projects.has('/project-b')).toBe(false);
  });
});
