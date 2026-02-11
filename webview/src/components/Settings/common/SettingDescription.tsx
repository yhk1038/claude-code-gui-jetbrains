interface SettingDescriptionProps {
  children: React.ReactNode;
}

export function SettingDescription({ children }: SettingDescriptionProps) {
  return (
    <p className="text-xs text-zinc-500 mt-1">
      {children}
    </p>
  );
}
