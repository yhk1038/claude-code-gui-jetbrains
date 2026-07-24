/**
 * Announcement eligibility rules — webview side.
 *
 * The pure eligibility logic (`isEligible`, `selectForPlacement`,
 * `satisfiesVersionRange`, `AnnouncementEligibilityContext`) is owned by the
 * shared `@ccg/announcement-core` package (source of truth:
 * `www/packages/announcement-core`), vendored at
 * `webview/src/vendor/announcement-core`. This file re-exports it so existing
 * webview imports (e.g. `useAnnouncements`) stay unchanged while the plugin and
 * the www admin share one implementation.
 */
export * from '@/vendor/announcement-core/eligibility';
