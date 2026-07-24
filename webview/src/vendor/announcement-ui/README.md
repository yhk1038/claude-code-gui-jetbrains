# vendor/announcement-ui (AUTO-GENERATED — do not edit)

This directory is a **vendored copy** of the shared announcement presentation
package (`@ccg/announcement-ui`). It is copied verbatim (with a generated
header) by `scripts/sync-announcement-ui.sh` from the source of truth:

    www/packages/announcement-ui/src

The only transform applied is rewriting `@ccg/announcement-core` →
`@/vendor/announcement-core` so the vendored UI imports the also-vendored core.

Do **not** edit files here. To change the presentation, edit the www original
and re-run:

    bash ./scripts/build.sh sync-announcement-ui

The plugin webview imports `AnnouncementView` from here so it renders the exact
same markup as the www admin — the two can never disagree pixel-for-pixel. Only
behavior (action dispatch / dismiss) is injected per-consumer via the
`onAction`/`onDismiss` callback props.
