import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { NavLink } from "./NavLink";
import { Button } from "./Button";
import { MobileMenu } from "./MobileMenu";
import { createSessionClient } from "@/lib/supabase-server";

const navItems = [
  { href: "/about", label: "About" },
  { href: "/classes", label: "Classes" },
  { href: "/coaches", label: "Coaches" },
  { href: "/fees", label: "Fees" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  const memberNavItem = user
    ? { href: "/member", label: "My Account" }
    : { href: "/login", label: "Member Login" };

  return (
    <header className="relative border-b border-rule bg-paper">
      <Container className="flex items-center justify-between py-5">
        <Link
          href="/"
          className="flex items-center gap-3 text-ink hover:text-purple-700 transition-colors"
        >
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            priority
            className="h-10 w-10 md:h-12 md:w-12 object-contain"
          />
          <span className="font-display text-lg leading-none tracking-tight">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-0.5">
              Est. 1997
            </span>
            Des Moines Fencing Club
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
          <NavLink
            href={memberNavItem.href}
            className="border border-rule px-3 py-1.5 rounded-[3px] hover:border-brass transition-colors"
          >
            {memberNavItem.label}
          </NavLink>
          <Button as="link" href="/observe" variant="primary">
            Observe a Class
          </Button>
        </nav>

        <div className="lg:hidden flex items-center gap-2">
          <Button as="link" href="/observe" variant="primary">
            Observe
          </Button>
          <MobileMenu items={[...navItems, memberNavItem]} />
        </div>
      </Container>
    </header>
  );
}
