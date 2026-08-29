"use client";

import { Button } from "@/components/Button";

// A plain window.print() is enough here — the print stylesheet on the
// roster page itself (print:hidden on nav chrome, print:hidden here too)
// does the actual work. No PDF library or server-rendered print route.
export function PrintRosterButton() {
  return (
    <Button as="button" onClick={() => window.print()} arrow="none" variant="secondary" className="print:hidden">
      Print roster
    </Button>
  );
}
