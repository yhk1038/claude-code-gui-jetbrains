import { useState } from 'react';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { parseMcpJson, ParsedMcpServer } from '@/utils/parseMcpJson';

interface Props {
  /** Pre-fill the Name field (used when arriving from the marketplace or editing). */
  initialName?: string;
  /** Pre-fill the JSON box (used when arriving from the marketplace or editing). */
  initialJson?: string;
  /** Pre-select the Scope dropdown (used when editing an existing server). */
  initialScope?: string;
  /**
   * 'add' (default) shows the Add UI. 'edit' relabels title/submit and means the
   * submit handler replaces an existing server (remove → add-json) rather than
   * creating a new one. The on-wire path is identical — only the copy differs.
   */
  mode?: 'add' | 'edit';
  onAdd: (servers: ParsedMcpServer[], scope: string) => Promise<void>;
  onCancel: () => void;
  /** Report submit-in-progress so the parent can lock the whole modal. */
  onBusyChange?: (busy: boolean) => void;
}

const PLACEHOLDER = `{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}`;

export function McpAddForm(props: Props) {
  const { t } = useTranslation('common');
  const { onAdd, onCancel, initialName, initialJson, initialScope, mode = 'add', onBusyChange } = props;
  const isEdit = mode === 'edit';
  const [name, setName] = useState(initialName ?? '');
  const [scope, setScope] = useState(initialScope ?? 'user');
  const [json, setJson] = useState(initialJson ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const parsed = parseMcpJson(json, name);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      await onAdd(parsed.servers, scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors flex-shrink-0 disabled:opacity-50"
            title={t('mcpModal.form.back')}
          >
            <ArrowLeftIcon className="w-5 h-5 rtl:-scale-x-100" />
          </button>
          <h3 className="text-lg font-semibold text-text-primary">{isEdit ? t('mcpModal.form.editTitle') : t('mcpModal.form.addTitle')}</h3>
        </div>

        {error && (
          <p className="text-xs text-state-error-fg whitespace-pre-wrap">{error}</p>
        )}

        {/* Name (optional — used only when the pasted JSON has no mcpServers wrapper) */}
        <Field label={t('mcpModal.form.nameLabel')} hint={t('mcpModal.form.nameHint')}>
          <input
            className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('mcpModal.form.namePlaceholder')}
            disabled={busy}
          />
        </Field>

        {/* Scope */}
        <Field label={t('mcpModal.form.scopeLabel')}>
          <select
            className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={busy}
          >
            <option value="user">{t('mcpModal.form.scopeUser')}</option>
            <option value="project">{t('mcpModal.form.scopeProject')}</option>
            <option value="local">{t('mcpModal.form.scopeLocal')}</option>
          </select>
        </Field>

        {/* JSON config */}
        <Field label={t('mcpModal.form.configLabel')} hint={t('mcpModal.form.configHint')}>
          <textarea
            className="w-full h-44 text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary font-mono resize-y focus:outline-none focus:border-accent-primary disabled:opacity-50"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={PLACEHOLDER}
            autoFocus
            spellCheck={false}
            disabled={busy}
          />
        </Field>
      </div>

      {/* Footer — while saving, hide Cancel and make the spinner button full-width */}
      <div className="px-4 pb-4 pt-2 flex gap-2">
        {!busy && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-md py-2 rounded bg-surface-hover text-text-secondary hover:bg-surface-raised transition-colors"
          >
            {t('mcpModal.form.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className={`text-md py-2 rounded bg-accent-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center ${busy ? 'w-full' : 'flex-1'}`}
        >
          {busy ? (
            <ArrowPathIcon className="w-5 h-5 animate-spin" aria-label={isEdit ? t('mcpModal.form.saving') : t('mcpModal.form.adding')} />
          ) : isEdit ? t('mcpModal.form.save') : t('mcpModal.form.addButton')}
        </button>
      </div>
    </form>
  );
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-tertiary mb-1.5">{props.label}</label>
      {props.children}
      {props.hint && <p className="mt-1 text-xs text-text-tertiary">{props.hint}</p>}
    </div>
  );
}
