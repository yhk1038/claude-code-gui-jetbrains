/**
 * Dotted-numeric version comparison — webview side.
 *
 * `compareVersions` / `isAtLeastVersion` are owned by the shared
 * `@ccg/announcement-core` package (source of truth:
 * `www/packages/announcement-core`), vendored at
 * `webview/src/vendor/announcement-core`. This file re-exports them so existing
 * `@/utils/compareVersions` imports keep working while the plugin and the www
 * admin share one comparator.
 */
export * from '@/vendor/announcement-core/compareVersions';
