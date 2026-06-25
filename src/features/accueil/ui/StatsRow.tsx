export function StatsRow({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div data-testid="kpi-tiles" className="grid grid-cols-2 border-y border-line md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={[
            "px-5 py-4",
            i % 2 === 1 ? "border-l border-line" : "",
            i >= 2 ? "border-t border-line" : "",
            "md:border-l md:border-line md:border-t-0 md:first:border-l-0",
          ].join(" ")}
        >
          <div className="font-serif text-3xl font-medium text-ink">{s.value}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
