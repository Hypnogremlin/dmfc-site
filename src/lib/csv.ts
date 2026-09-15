// Shared RFC 4180 CSV helpers.
//
// Extracted from src/lib/cron/usafReport.ts, which was the only CSV producer
// until the Google Contacts export arrived. Both write files that a third
// party parses (USA Fencing's Bulk Uploader; Google Contacts' importer), so
// the quoting and line-ending rules below are not stylistic — changing them
// breaks an upload somebody else's system rejects.

/**
 * Quote a cell only when it contains a comma, quote, or newline; double
 * internal quotes per RFC 4180.
 */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * A column is a `[header, accessor]` pair. Declaring them as an array keeps
 * the header row and the value that fills it adjacent, so a column can never
 * drift out of position relative to its own data.
 */
export type CsvColumn<T> = [string, (row: T) => string];

/**
 * Build a full CSV document from columns + rows.
 *
 * The leading U+FEFF byte-order mark makes Excel open the file as UTF-8 so
 * accented names survive; CRLF line endings are what both consuming systems
 * expect. Written as the "﻿" escape rather than a literal BOM character
 * so it is visible in a diff — the output is byte-identical either way.
 */
export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map(([name]) => csvCell(name)).join(",");
  const lines = rows.map((row) =>
    columns.map(([, get]) => csvCell(get(row))).join(",")
  );
  return "﻿" + [header, ...lines].join("\r\n");
}
