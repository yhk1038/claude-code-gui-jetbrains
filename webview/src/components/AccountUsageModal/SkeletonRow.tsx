export function SkeletonRow() {
  return (
    <div className="py-3 border-b border-white/5 last:border-b-0 space-y-2">
      <div className="flex justify-between">
        <div className="h-4 w-28 bg-zinc-700 rounded animate-pulse" />
        <div className="h-4 w-10 bg-zinc-700 rounded animate-pulse" />
      </div>
      <div className="h-1.5 bg-zinc-700 rounded-full animate-pulse" />
      <div className="h-3 w-24 bg-zinc-700/60 rounded animate-pulse" />
    </div>
  );
}
