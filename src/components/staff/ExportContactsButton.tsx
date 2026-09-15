"use client";

import { ConfirmButton } from "@/components/ConfirmButton";

// Downloads the roster as a Google Contacts import CSV. Two-step confirm
// because a single click here puts every member's name, email, phone and home
// address into the coach's Downloads folder — reversibility is the test, and
// a file that has left the building can't be recalled.
//
// The download is a plain navigation to the route handler, which answers with
// Content-Disposition: attachment. The browser saves the file without leaving
// the page, so there's no need for a Blob or URL.createObjectURL — neither has
// any precedent in this codebase.
export function ExportContactsButton() {
  return (
    <ConfirmButton
      label="Export for Google Contacts"
      confirmLabel="Download CSV"
      confirmText="This file has members' names, emails, phone numbers, and home addresses. DMFC staff only — don't forward or share it."
      variant="secondary"
      onConfirm={() => {
        window.location.href = "/api/staff/contacts-export";
      }}
    />
  );
}
