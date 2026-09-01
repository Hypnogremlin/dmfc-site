"use client";

import { Button } from "@/components/Button";

// Same pattern as PrintRosterButton: a plain window.print() is enough
// because the print stylesheet lives on the directory page itself
// (print:hidden on the search form/nav).
export function PrintDirectoryButton() {
  return (
    <Button as="button" onClick={() => window.print()} arrow="none" variant="secondary" className="print:hidden">
      Print list
    </Button>
  );
}
