"use client";

import { useState } from "react";

// Dummy (preview-only) calendar for the /observe form. Sun→Sat grid; Mondays
// and Thursdays expose weapon chips that the visitor can toggle on/off.
// Session selections live in the parent ObservationForm; only the viewed
// month is local state so navigating months doesn't disturb selections.
// Weapon-day mapping matches /classes: Mon = Foil + Épée, Thu = Saber.

export type Weapon = "foil-youth" | "foil-adult" | "epee" | "saber";

export interface SessionSelection {
  date: string; // YYYY-MM-DD
  weapon: Weapon;
}

interface Props {
  selected: SessionSelection[];
  onToggle: (date: string, weapon: Weapon) => void;
}

const WEAPON_LABELS: Record<Weapon, string> = {
  "foil-youth": "Foil Youth · 6:30p",
  "foil-adult": "Foil Adult · 8:00p",
  epee: "Épée · 6:30p",
  saber: "Saber · 6:30p",
};

// Short chip labels — keep cells compact.
const WEAPON_CHIPS: Record<Weapon, string> = {
  "foil-youth": "Fy",
  "foil-adult": "Fa",
  epee: "E",
  saber: "S",
};

// Color tokens per weapon. All drawn from the existing DESIGN.md palette
// (brass + purple + ink) so no new colors are introduced.
const WEAPON_CLASSES: Record<
  Weapon,
  { selected: string; idle: string; ring: string }
> = {
  "foil-youth": {
    selected: "bg-brass text-ink border-brass",
    idle: "bg-transparent text-brass border-brass/50 hover:bg-brass/15",
    ring: "ring-brass",
  },
  "foil-adult": {
    selected: "bg-orange-500 text-white border-orange-500",
    idle: "bg-transparent text-orange-500 border-orange-500/50 hover:bg-orange-500/15",
    ring: "ring-orange-500",
  },
  epee: {
    selected: "bg-purple-700 text-paper border-purple-700",
    idle:
      "bg-transparent text-purple-700 border-purple-700/40 hover:bg-purple-700/10",
    ring: "ring-purple-700",
  },
  saber: {
    selected: "bg-ink text-paper border-ink",
    idle: "bg-transparent text-ink border-ink/40 hover:bg-ink/10",
    ring: "ring-ink",
  },
};

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  const cells: Array<{ day: number; iso: string; weekday: number } | null> =
    [];
  // Leading empty cells so the 1st sits in the right weekday column.
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    cells.push({ day, iso, weekday: d.getDay() });
  }
  return {
    cells,
    monthLabel: firstOfMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

function getAvailableWeapons(weekday: number): Weapon[] {
  // 1 = Monday, 4 = Thursday
  if (weekday === 1) return ["foil-youth", "foil-adult", "epee"];
  if (weekday === 4) return ["saber"];
  return [];
}

export function ObservationCalendar({ selected, onToggle }: Props) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // The viewed month is local state — selecting sessions while looking at
  // July, then flipping back to May, leaves the parent's selections intact.
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { cells, monthLabel } = buildMonthGrid(viewYear, viewMonth);

  // Can't go to past months — there's no scenario where someone schedules
  // a future visit in an already-elapsed month.
  const atCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const isSelected = (iso: string, weapon: Weapon) =>
    selected.some((s) => s.date === iso && s.weapon === weapon);

  const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <NavButton
            direction="prev"
            disabled={atCurrentMonth}
            onClick={() => shiftMonth(-1)}
          />
          <h3 className="font-display text-2xl text-ink min-w-[180px]">
            {monthLabel}
          </h3>
          <NavButton direction="next" onClick={() => shiftMonth(1)} />
        </div>
        <div className="flex items-center gap-4 text-xs text-mute">
          <LegendDot weapon="foil-youth" />
          <LegendDot weapon="foil-adult" />
          <LegendDot weapon="epee" />
          <LegendDot weapon="saber" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-rule border border-rule">
        {weekdayHeaders.map((w) => (
          <div
            key={w}
            className="bg-paper text-mute text-[10px] font-semibold uppercase tracking-[0.12em] py-2 text-center"
          >
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="bg-paper min-h-[72px]" />;
          }
          const isPast = cell.iso < todayIso;
          const available = getAvailableWeapons(cell.weekday);
          const isActive = available.length > 0 && !isPast;

          return (
            <div
              key={cell.iso}
              className={`bg-paper min-h-[72px] p-2 flex flex-col ${
                isPast ? "opacity-40" : ""
              }`}
            >
              <div
                className={`tabular text-xs ${
                  isActive ? "text-ink font-semibold" : "text-mute"
                }`}
              >
                {cell.day}
              </div>
              {isActive && (
                <div className="mt-auto flex flex-wrap gap-1">
                  {available.map((weapon) => {
                    const sel = isSelected(cell.iso, weapon);
                    const cls = WEAPON_CLASSES[weapon];
                    return (
                      <button
                        type="button"
                        key={weapon}
                        onClick={() => onToggle(cell.iso, weapon)}
                        aria-pressed={sel}
                        aria-label={`${WEAPON_LABELS[weapon]} — ${cell.iso}`}
                        className={`w-6 h-6 inline-flex items-center justify-center text-[11px] font-semibold border rounded-sm transition-colors ${
                          sel ? cls.selected : cls.idle
                        }`}
                      >
                        {WEAPON_CHIPS[weapon]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-mute mt-3 leading-relaxed">
        Click a chip to add or remove that session. Mondays:{" "}
        <strong className="text-ink">Fy</strong> Foil Youth 6:30p ·{" "}
        <strong className="text-ink">Fa</strong> Foil Adult 8:00p ·{" "}
        <strong className="text-ink">E</strong> Épée 6:30p — Thursdays:{" "}
        <strong className="text-ink">S</strong> Saber 6:30p
      </p>
    </div>
  );
}

function NavButton({
  direction,
  onClick,
  disabled = false,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = direction === "prev" ? "Previous month" : "Next month";
  const glyph = direction === "prev" ? "‹" : "›";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-8 h-8 inline-flex items-center justify-center border border-rule text-ink rounded-sm hover:border-brass hover:text-purple-700 disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink disabled:cursor-not-allowed transition-colors"
    >
      <span aria-hidden="true" className="text-xl leading-none">
        {glyph}
      </span>
    </button>
  );
}

function LegendDot({ weapon }: { weapon: Weapon }) {
  const cls = WEAPON_CLASSES[weapon].selected;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-3 h-3 inline-block border rounded-sm ${cls}`}
        aria-hidden="true"
      />
      <span className="uppercase tracking-wider">{WEAPON_LABELS[weapon]}</span>
    </span>
  );
}
