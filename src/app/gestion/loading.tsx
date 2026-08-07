export default function Loading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
      <span className="relative flex h-11 w-11 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-[#1D2D50]/15" />
        <span className="tsp-nav-spin absolute inset-0 rounded-full border-2 border-transparent border-t-[#1D2D50] border-r-[#FFCD79]" />
      </span>
      <p className="text-sm text-[var(--muted)]">Chargement…</p>
    </div>
  );
}
