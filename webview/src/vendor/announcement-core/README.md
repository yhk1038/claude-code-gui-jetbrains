# vendor/announcement-core (AUTO-GENERATED — do not edit)

This directory is a **vendored copy** of the shared, framework-agnostic
announcement rules package. It is copied verbatim (with a generated header) by
`scripts/sync-announcement-core.sh` from the source of truth:

    www/packages/announcement-core/src

Do **not** edit files here. To change the rules, edit the www original and
re-run:

    bash ./scripts/build.sh sync-announcement-core

The plugin webview imports these modules so it enforces the exact same schema,
eligibility, restricted-markdown parsing, urlSafety, and icon whitelist as the
www admin — the two can never disagree.
