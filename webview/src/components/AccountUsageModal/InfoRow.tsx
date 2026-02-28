interface InfoRowProps {
  label: string;
  value: string | null;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[12px] text-zinc-400">{label}</span>
      <span className="text-[12px] text-zinc-200">{value ?? '—'}</span>
    </div>
  );
}
