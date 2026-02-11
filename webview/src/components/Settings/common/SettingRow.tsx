import { SettingDescription } from './SettingDescription';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
      <div className="flex-1 mr-4">
        <label className="text-sm text-zinc-200">{label}</label>
        {description && <SettingDescription>{description}</SettingDescription>}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}
