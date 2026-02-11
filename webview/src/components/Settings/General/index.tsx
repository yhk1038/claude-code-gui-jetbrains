import { SettingSection, SettingRow } from '../common';
import { ROUTE_META, Route } from '@/router/routes';

export function GeneralSettings() {
  const meta = ROUTE_META[Route.SETTINGS_GENERAL];

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Application">
        <SettingRow
          label="Language"
          description="Interface language (restart required)"
        >
          <select
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
