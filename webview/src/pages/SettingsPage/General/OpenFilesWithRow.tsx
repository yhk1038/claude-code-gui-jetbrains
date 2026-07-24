import { useState, useEffect } from 'react';
import { SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { useBridge } from '@/hooks/useBridge';
import { SettingKey } from '@/types/settings';
import { MessageType } from '@/shared';
import { useTranslation } from '@/i18n';
import { IdeProductIcon } from '@/components/IdeProductIcon';

interface EditorInfo {
  id: string;
  label: string;
  isDefault: boolean;
}

const CUSTOM_MARKER = '__custom__';

function toSelectValue(app: string | null, editors: EditorInfo[]): string {
  if (app === null) return '';
  if (editors.some((e) => e.label === app)) return app;
  return CUSTOM_MARKER;
}

/**
 * "Open files with" — which program opens a file reference clicked in chat.
 *
 * When an IDE (Kotlin RPC) host is attached to the backend — a JCEF webview OR a
 * browser tab opened from an IDE session — the file always opens in that IDE, so
 * the value is fixed and shown with the IDE's product badge (not editable). With
 * no IDE attached (standalone / dev browser) the user picks a detected editor or
 * a custom program; null means the OS default opener.
 */
export function OpenFilesWithRow() {
  const { t } = useTranslation('settings');
  const { settings, updateSetting, ideAttached, ideProduct } = useSettings();
  const { send } = useBridge();

  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No picker when the IDE owns file opening — skip the detection round-trip.
    if (ideAttached) {
      setLoading(false);
      return;
    }
    send(MessageType.GET_AVAILABLE_EDITORS, {})
      .then((res) => {
        setEditors((res?.editors as EditorInfo[]) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [send, ideAttached]);

  const openFilesWith = settings[SettingKey.OPEN_FILES_WITH];
  const selectValue = toSelectValue(openFilesWith, editors);
  const [customInput, setCustomInput] = useState(
    selectValue === CUSTOM_MARKER ? (openFilesWith ?? '') : '',
  );

  const handleSelectChange = (value: string) => {
    if (value === CUSTOM_MARKER) {
      void updateSetting(SettingKey.OPEN_FILES_WITH, customInput || null);
    } else {
      void updateSetting(SettingKey.OPEN_FILES_WITH, value || null);
    }
  };

  const handleCustomInput = (value: string) => {
    setCustomInput(value);
    void updateSetting(SettingKey.OPEN_FILES_WITH, value || null);
  };

  if (ideAttached) {
    return (
      <SettingRow
        label={t('general.openFilesWith.label')}
        description={t('general.openFilesWith.jetbrainsDescription')}
      >
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <IdeProductIcon product={ideProduct} />
          <span>{ideProduct || t('general.openFilesWith.jetbrainsFallback')}</span>
        </div>
      </SettingRow>
    );
  }

  const options: SelectOption[] = [
    { value: '', label: t('general.openFilesWith.systemDefault') },
    ...editors.map((editor) => ({ value: editor.label, label: editor.label })),
    { value: CUSTOM_MARKER, label: t('general.openFilesWith.custom') },
  ];

  return (
    <SettingRow
      label={t('general.openFilesWith.label')}
      description={t('general.openFilesWith.description')}
    >
      {loading ? (
        <span className="text-sm text-text-tertiary">{t('general.openFilesWith.detecting')}</span>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            value={selectValue}
            options={options}
            ariaLabel={t('general.openFilesWith.label')}
            onChange={handleSelectChange}
            className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
          />
          {selectValue === CUSTOM_MARKER && (
            <input
              type="text"
              value={customInput}
              onChange={(e) => handleCustomInput(e.target.value)}
              placeholder={t('general.openFilesWith.customPlaceholder')}
              className="w-40 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
            />
          )}
        </div>
      )}
    </SettingRow>
  );
}
