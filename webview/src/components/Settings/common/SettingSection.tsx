interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-4">
        {children}
      </div>
    </section>
  );
}
