/**
 * URL scheme allow-lists for announcement content — webview side.
 *
 * `isSafeLinkUrl` / `isSafeImageUrl` are owned by the shared
 * `@ccg/announcement-core` package (source of truth:
 * `www/packages/announcement-core`), vendored at
 * `webview/src/vendor/announcement-core`. This file re-exports them so existing
 * `./urlSafety` imports keep working while the plugin and the www admin apply
 * the exact same scheme allow-lists.
 */
export * from '@/vendor/announcement-core/urlSafety';
