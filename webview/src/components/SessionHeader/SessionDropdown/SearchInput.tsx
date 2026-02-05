interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="p-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1.5 rounded outline-none placeholder:text-zinc-500"
        placeholder="Search sessions..."
        autoFocus
      />
    </div>
  );
}
