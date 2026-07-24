/**
 * Server-Driven UI (SDUI) Announcements contract.
 *
 * These types describe the payload the announcements delivery endpoint sends
 * to the client, and are the shared vocabulary between the server, the
 * Node.js backend, and the WebView renderer.
 *
 * NOTE: This file is mirrored 1:1 in `backend/src/shared/announcement.ts`.
 * Any edit here MUST be copied there (see `shared/CLAUDE.md`).
 */

/** Where an announcement is allowed to render in the UI. */
export enum AnnouncementPlacement {
  /** Rendered inside an empty chat's empty-state area. */
  EMPTY_STATE = 'EMPTY_STATE',
  /** Rendered in the top banner area (BannerArea), above the chat. */
  TOP_BANNER = 'TOP_BANNER',
  /** Rendered as an input banner, directly above the chat composer. */
  INPUT_BANNER = 'INPUT_BANNER',
  /** Rendered as a modal dialog. */
  MODAL = 'MODAL',
}

/** What happens when the user activates an announcement action. */
export enum AnnouncementActionType {
  /** Open an external URL (uses `AnnouncementAction.url`). */
  OPEN_URL = 'OPEN_URL',
  /** Dismiss the announcement without any further side effect. */
  DISMISS = 'DISMISS',
  /** Navigate to an in-app route (uses `AnnouncementAction.route`). */
  NAVIGATE = 'NAVIGATE',
  /** Run a client-defined command (uses `AnnouncementAction.command`). */
  RUN_COMMAND = 'RUN_COMMAND',
}

/** Kind of media attached to an announcement or one of its steps. */
export enum AnnouncementMediaType {
  /** A static image (png/jpg/webp/svg). */
  IMAGE = 'IMAGE',
  /** An animated GIF. */
  GIF = 'GIF',
  /** A video clip (e.g. mp4/webm). */
  VIDEO = 'VIDEO',
}

/**
 * A piece of media (image/gif/video) attached to an announcement or one of its
 * steps. `url` must be https to be trusted — the renderer additionally validates
 * it against an `isSafeImageUrl`-style whitelist before display. `alt` is
 * accessibility text.
 */
export interface AnnouncementMedia {
  type: AnnouncementMediaType;
  url: string;
  /** Accessibility alt text. */
  alt?: string;
}

/**
 * One step of a multi-step (series/carousel) announcement, as DELIVERED to the
 * client. Only `media` is authored on the step's structure; the per-locale
 * `title`/`body` text is authored in the announcement's translations and is
 * merged into each step by the delivery endpoint at request time (mirroring how
 * an action's per-locale `label` is merged). See `Announcement.steps`.
 */
export interface AnnouncementStep {
  /** Optional media (image/gif/video) shown for this step. */
  media?: AnnouncementMedia;
  /** Step title (localized) — merged in from translations at delivery time. */
  title?: string;
  /** Step body: restricted markdown (localized) — merged in from translations at delivery time. */
  body: string;
}

/** How often an announcement should be (re-)shown to the user. */
export enum AnnouncementFrequency {
  /** Show once, then never again after the first dismissal/view. */
  ONCE = 'ONCE',
  /** Keep showing on every eligible occasion until the user dismisses it. */
  UNTIL_DISMISSED = 'UNTIL_DISMISSED',
  /** Always show when eligible, regardless of prior dismissal. */
  ALWAYS = 'ALWAYS',
}

/** A single actionable button/link on an announcement. */
export interface AnnouncementAction {
  id: string;
  label: string;
  type: AnnouncementActionType;
  /** Target URL. Used when `type === AnnouncementActionType.OPEN_URL`. */
  url?: string;
  /** In-app route. Used when `type === AnnouncementActionType.NAVIGATE`. */
  route?: string;
  /** Client-defined command name. Used when `type === AnnouncementActionType.RUN_COMMAND`. */
  command?: string;
}

/** Targeting/scheduling rules controlling whether an announcement is eligible to show. */
export interface AnnouncementTarget {
  /** Semver range string (e.g. ">=0.25.0") the installed plugin version must satisfy. */
  pluginVersion?: string;
  /** ISO 8601 timestamp; announcement is not eligible before this time. */
  showFrom?: string;
  /** ISO 8601 timestamp; announcement is not eligible after this time. */
  showUntil?: string;
  /** Re-show policy for this announcement. */
  frequency: AnnouncementFrequency;
}

/** A single server-driven announcement. */
export interface Announcement {
  id: string;
  /** Surfaces this announcement is allowed to render in. */
  placements: AnnouncementPlacement[];
  /** Sort key for ordering announcements within a placement; higher shows first (descending). */
  priority: number;
  /**
   * Bundled icon name. This is an open-ended string (not an enum) because the
   * server may send icon names the client doesn't yet recognize; the renderer
   * (a later checklist item) validates it against a bundled-icon whitelist and
   * falls back to a default icon when unknown.
   */
  icon: string;
  /** Optional illustration/image URL. */
  imageUrl?: string;
  /** Optional media (image/gif/video) for a single (non-series) announcement. */
  media?: AnnouncementMedia;
  title: string;
  /** Restricted markdown (bold/link/list only) — rendered by the announcement renderer. */
  body: string;
  /**
   * When present and non-empty, this announcement is a multi-step series
   * (a carousel with Back/Next and a "2/4" progress indicator); each step
   * carries its own optional media plus localized title/body. When absent, the
   * announcement renders with the classic single `title`/`body` above.
   */
  steps?: AnnouncementStep[];
  /** Whether the user can dismiss this announcement without taking an action. */
  dismissible: boolean;
  actions: AnnouncementAction[];
  target: AnnouncementTarget;
}

/** Response envelope of the announcements delivery endpoint. */
export interface AnnouncementsResponse {
  schemaVersion: number;
  announcements: Announcement[];
}

/** Result payload of the GET_ANNOUNCEMENTS handler: the (validated) delivery response plus the ids the user already dismissed (from profile.json). */
export interface GetAnnouncementsResult {
  schemaVersion: number;
  announcements: Announcement[];
  dismissedIds: string[];
}
