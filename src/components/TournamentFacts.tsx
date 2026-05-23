import { formatDateLong, type TournamentEntry } from "@/lib/news";

// Structured fact block rendered at the top of a tournament detail page.
// Sits above the prose body and gives visitors the load-bearing details
// (when, where, how to register) without making them scan the article.
export function TournamentFacts({ entry }: { entry: TournamentEntry }) {
  const weaponLabels: Record<TournamentEntry["weapons"][number], string> = {
    foil: "Foil",
    epee: "Épée",
    saber: "Saber",
  };

  return (
    <aside className="border-y border-rule py-8 my-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
      <Fact label="Date">
        <span className="font-display text-2xl text-ink leading-tight">
          {formatDateLong(entry.date)}
        </span>
      </Fact>

      <Fact label="Location">
        <span className="text-ink leading-snug">{entry.location}</span>
      </Fact>

      <Fact label="Weapons">
        <span className="text-ink">
          {entry.weapons.map((w) => weaponLabels[w]).join(" · ")}
        </span>
      </Fact>

      {entry.format && (
        <Fact label="Format">
          <span className="text-ink/85 text-sm leading-snug">
            {entry.format}
          </span>
        </Fact>
      )}

      {entry.registrationDeadline && (
        <Fact label="Registration deadline">
          <span className="tabular text-ink">
            {formatDateLong(entry.registrationDeadline)}
          </span>
        </Fact>
      )}

      {entry.registrationUrl && (
        <Fact label="Register">
          <a
            href={entry.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-draw text-purple-700 hover:text-purple-900 break-words"
          >
            Open registration page →
          </a>
        </Fact>
      )}
    </aside>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.16em] mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
