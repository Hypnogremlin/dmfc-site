export type ScheduleRow = {
  day: string;
  time: string;
  segment: string;
  ageGroup: string;
};

export function ScheduleTable({
  rows,
  className = "",
}: {
  rows: ScheduleRow[];
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Class schedule by day, time, segment, and age group.
        </caption>
        <thead>
          <tr className="border-b border-brass/40">
            <th
              scope="col"
              className="py-3 pr-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute"
            >
              Segment
            </th>
            <th
              scope="col"
              className="py-3 pr-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute hidden sm:table-cell"
            >
              Ages
            </th>
            <th
              scope="col"
              className="py-3 pr-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute"
            >
              Day
            </th>
            <th
              scope="col"
              className="py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute"
            >
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.day}-${row.time}-${i}`}
              className="border-b border-rule align-top"
            >
              <th
                scope="row"
                className="py-5 pr-6 font-display text-xl md:text-2xl text-ink font-normal"
              >
                <span className="inline-block border-l-2 border-brass pl-3">
                  {row.segment}
                </span>
              </th>
              <td className="py-5 pr-6 text-[15px] text-mute hidden sm:table-cell">
                {row.ageGroup}
              </td>
              <td className="py-5 pr-6 text-[15px] text-ink whitespace-nowrap">
                {row.day}
              </td>
              <td className="py-5 tabular text-[15px] text-ink whitespace-nowrap">
                {row.time}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="sm:hidden mt-4 text-[11px] uppercase tracking-[0.14em] text-mute">
        Age detail visible on larger screens.
      </p>
    </div>
  );
}
