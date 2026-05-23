"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "./Container";

type NavItem = { href: string; label: string };

export function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center text-ink hover:text-purple-700 transition-colors"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="square" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="square" />
          </svg>
        )}
      </button>

      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 top-[var(--header-h,72px)] z-40 bg-ink/20"
        />
      )}

      <div
        id="mobile-nav-panel"
        className={`lg:hidden absolute left-0 right-0 top-full z-50 origin-top border-b border-rule bg-paper transition-[transform,opacity] duration-200 ease-out ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <Container className="py-2">
          <ul className="divide-y divide-rule">
            {items.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    data-active={isActive}
                    className="flex items-center justify-between py-4 font-display text-xl text-ink hover:text-purple-700 transition-colors data-[active=true]:text-purple-700"
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span aria-hidden="true" className="text-brass text-sm tracking-[0.3em]">
                        —
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </div>
    </>
  );
}
