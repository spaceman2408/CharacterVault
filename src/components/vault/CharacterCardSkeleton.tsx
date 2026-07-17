export function CharacterCardSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
      <div className="aspect-3/4 w-full skeleton" />
      <div className="flex flex-col gap-0 p-2.5 sm:gap-3 sm:p-4">
        <div className="h-3.5 sm:h-4 w-3/4 rounded-md skeleton" />
        <div className="hidden sm:flex flex-col gap-3">
          <div className="flex gap-1.5">
            <div className="h-5 w-14 rounded-full skeleton" />
            <div className="h-5 w-16 rounded-full skeleton" />
          </div>
          <div className="h-3 w-full rounded-md skeleton" />
          <div className="h-6 w-24 rounded-full skeleton" />
        </div>
      </div>
    </div>
  );
}
