---
name: add-locale
description: Add a new UI language/locale to the claude-code-gui webview i18n system, or extend/verify an existing one. Walks a contributor (or agent) through creating the per-namespace translation JSON files, registering the locale, and verifying parity — consistently with how the shipped locales are structured. Use when someone wants to translate the UI into a new language, add a locale, or contribute translations. Trigger on: 언어 추가, 로케일 추가, 새 언어, 번역 추가, 번역 기여, add language, add locale, new language, translate the UI, contribute a translation, i18n locale.
---

# Add a UI locale to the webview

The webview UI is internationalized with **react-i18next**. Every language is a
folder of JSON catalogs under `webview/src/i18n/locales/<locale>/`, one file per
**namespace** (page/area). English (`en`) is the source of truth and the
fallback for any missing key.

Adding a language = (1) create that folder of translated JSON, (2) register the
language in two small code spots. `config.ts` auto-loads locale files via a Vite
glob, so **you never edit `config.ts`**.

## 0. Pick the identifiers

- **locale** — a BCP-47 code and the folder name, e.g. `it` (Italian),
  `pt-BR` (Brazilian Portuguese), `zh-TW` (Traditional Chinese).
- **setting value** — the value stored in settings, a lowercase English name,
  e.g. `italian`. For script/region variants use a `-` suffix, e.g.
  `chinese-traditional`.
- **endonym** — the language's own name for the dropdown label, e.g. `Italiano`,
  `繁體中文`. (Labels are endonym-only — no romanized prefix.)

## 1. Create the translation files

List the namespaces (these are the English source files):

```
ls webview/src/i18n/locales/en/
# chat chatTools commandPalette common notifications permissions
# projectSelector sessionPanel settings switchAccount
```

Create `webview/src/i18n/locales/<locale>/<namespace>.json` for **every** file in
`en/`. Translate the string **values**; keep the **key structure identical** to
the English file.

Rules — same as the shipped locales:

- **Mirror keys exactly.** Same nesting, same key names as `en/`. Only values change.
- **Preserve interpolation placeholders verbatim**: `{{value}}`, `{{count}}`,
  `{{n}}`, `{{seconds}}`, `{{error}}`, `{{label}}`, `{{appName}}`, … Keep whatever
  the English value uses, in place.
- **Plurals**: if an English key uses i18next plural suffixes (`foo_one`/`foo_other`),
  produce the plural set your language needs. Languages with no plural distinction
  (ko/ja/zh) keep the same suffix keys with identical text. Languages with more
  categories (e.g. Russian: `_one`/`_few`/`_many`) may add those suffix keys — that
  is correct even though it means more keys than English for those entries.
- **Do NOT translate**: the brand "Claude Code", ALL-CAPS env vars
  (`CLAUDE_CONFIG_DIR`), file paths, URLs, acronyms (CLI, MCP, IDE, OS, URL),
  code identifiers, model names/IDs, shell commands, keyboard tokens (`Cmd+K`).
- Natural, concise UI phrasing. Match the tone of the existing locales.
- Every file must be **valid JSON**.

## 2. Register the locale (two spots)

**a. `webview/src/i18n/languageMap.ts`**
- Add the locale to `SUPPORTED_LOCALES`.
- Add `'<setting value>': '<locale>'` to `LANGUAGE_TO_LOCALE`.

**b. `webview/src/pages/SettingsPage/General/index.tsx`**
- Add `{ value: '<setting value>', label: '<endonym>' }` to `LANGUAGE_OPTIONS`.

`config.ts` picks up the new files automatically (glob) — do not edit it.

## 3. Verify

- **Key parity** — every locale namespace must have the same leaf keys as `en`
  (plural suffix variants aside). Run:

```
node -e '
const fs=require("fs"),p=require("path");
const base="webview/src/i18n/locales", L=process.argv[1];
const NS=fs.readdirSync(base+"/en").map(f=>f.replace(".json",""));
const leaves=(o,pre="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?leaves(v,pre+k+"."):[pre+k]);
const norm=k=>k.replace(/_(zero|one|two|few|many|other)$/,"");
let miss=0;
for(const ns of NS){
  const en=new Set(leaves(JSON.parse(fs.readFileSync(`${base}/en/${ns}.json`))).map(norm));
  let tr; try{tr=new Set(leaves(JSON.parse(fs.readFileSync(`${base}/${L}/${ns}.json`))).map(norm));}catch(e){console.log(`MISSING FILE ${L}/${ns}.json`);miss++;continue;}
  for(const k of en) if(!tr.has(k)){console.log(`${L}/${ns}: missing ${k}`);miss++;}
}
console.log(miss?`❌ ${miss} problems`:`✅ ${L} matches en`);
' <locale>
```

- **Type check** — `bash ./scripts/build.sh wv-lint` (must be clean).
- **Tests** — `bash ./scripts/build.sh wv-test`.
- **Eyeball it** — run the standalone dev server, open Settings → General →
  Interface Language, pick the new language, and click through the app.

## Notes

- The **Interface Language** (this) is separate from the **Claude response
  language** (a free-text field). Adding a UI locale only affects the interface.
- If you only ship some namespaces, untranslated keys fall back to English —
  the app still works. But aim for full parity per §3.
