/**
 * Server-Driven UI (SDUI) Announcements contract — webview side.
 *
 * The schema is now owned by the shared, framework-agnostic package
 * `@ccg/announcement-core` (source of truth: `www/packages/announcement-core`),
 * vendored into this repo at `webview/src/vendor/announcement-core` via
 * `scripts/sync-announcement-core.sh`. This file simply re-exports that vendored
 * schema so the entire webview keeps importing announcement enums/DTOs from
 * `@/shared` unchanged.
 *
 * NOTE: `backend/src/shared/announcement.ts` intentionally keeps its own inline
 * mirror (the Node backend does not consume the vendored package). Its enum
 * members and interface fields MUST stay spelling-identical to the vendored
 * schema re-exported here.
 */
export * from '@/vendor/announcement-core/schema';
