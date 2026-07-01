# Feature doc assets

Shared image assets for the feature docs under [`docs/features/`](../).

Feature docs live one level down in `NNN-feature_name/` folders and reference
images here with a relative path, e.g. from `005-cli_version_update/en.md`:

```markdown
![Update dropdown](../assets/005-update-dropdown.png)
```

## Naming

Prefix each file with the owning feature's 3-digit index so files group and
sort by feature: `005-update-dropdown.png`, `005-update-toast.png`, ….
