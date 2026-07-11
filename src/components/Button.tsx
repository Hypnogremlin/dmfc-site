import { ReactNode, ComponentPropsWithoutRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary";
type ArrowDirection = "right" | "left" | "none";

type ButtonAsButton = {
  as?: "button";
  variant?: Variant;
  arrow?: ArrowDirection;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">;

type ButtonAsLink = {
  as: "link";
  href: string;
  variant?: Variant;
  arrow?: ArrowDirection;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href">;

type ButtonProps = ButtonAsButton | ButtonAsLink;

const baseStyles =
  "inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors duration-150 rounded-[3px]";

const variantStyles: Record<Variant, string> = {
  primary: "bg-brass text-ink hover:bg-[oklch(70%_0.17_75)]",
  secondary:
    "border border-ink text-ink hover:bg-ink hover:text-paper bg-transparent",
};

export function Button(props: ButtonProps) {
  const { variant = "primary", arrow = "right", children, className = "" } = props as
    | (ButtonAsButton & { className?: string })
    | (ButtonAsLink & { className?: string });

  const classes = `${baseStyles} ${variantStyles[variant]} ${className}`;

  if (props.as === "link") {
    const { as: _as, variant: _v, arrow: _ar, children: _c, className: _cn, ...rest } =
      props;
    return (
      <Link className={classes} {...rest}>
        {arrow === "left" && <span aria-hidden="true">←</span>}
        {children}
        {arrow === "right" && <span aria-hidden="true">→</span>}
      </Link>
    );
  }

  const { as: _as, variant: _v, arrow: _ar, children: _c, className: _cn, ...rest } =
    props;
  return (
    <button className={classes} {...rest}>
      {arrow === "left" && <span aria-hidden="true">←</span>}
      {children}
      {arrow === "right" && <span aria-hidden="true">→</span>}
    </button>
  );
}
