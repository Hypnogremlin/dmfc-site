"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      data-active={isActive}
      className={`underline-draw text-sm font-medium text-ink/80 hover:text-ink transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
