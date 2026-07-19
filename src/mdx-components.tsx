import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { MdxImage } from "@/components/mdx/MdxImage";
import { PhotoGrid } from "@/components/mdx/PhotoGrid";

// Maps native MDX-rendered HTML elements to design-system-aware variants so
// authored Markdown inherits the site's editorial typography without needing
// to remember class names. Lives at src/ root because next/mdx auto-discovers
// it there (matches the `src/` layout convention).
export function useMDXComponents(
  components: MDXComponents = {}
): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="font-display text-4xl md:text-5xl text-ink mt-12 mb-6"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="font-display text-2xl md:text-3xl text-ink mt-10 mb-4"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="font-display text-xl md:text-2xl text-ink mt-8 mb-3"
        {...props}
      />
    ),
    p: (props) => (
      <p className="text-ink/85 leading-[1.65] my-5" {...props} />
    ),
    ul: (props) => (
      <ul
        className="list-disc pl-6 my-5 marker:text-brass space-y-1.5 text-ink/85"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="list-decimal pl-6 my-5 marker:text-brass marker:font-display space-y-1.5 text-ink/85"
        {...props}
      />
    ),
    li: (props) => <li className="leading-[1.6]" {...props} />,
    a: ({ href = "#", ...rest }: ComponentPropsWithoutRef<"a">) => {
      const isExternal = /^https?:\/\//.test(href);
      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-draw text-purple-700 hover:text-purple-900"
            {...rest}
          />
        );
      }
      return (
        <Link
          href={href}
          className="underline-draw text-purple-700 hover:text-purple-900"
          {...rest}
        />
      );
    },
    strong: (props) => <strong className="font-semibold text-ink" {...props} />,
    em: (props) => <em className="italic" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="border-l-2 border-brass pl-5 my-6 text-ink/75 italic"
        {...props}
      />
    ),
    hr: () => (
      <hr className="my-10 border-0 h-px bg-rule" />
    ),
    // Markdown images (`![alt](/path "caption")`) get build-time sizing and
    // next/image optimization. PhotoGrid is registered by name so MDX entries
    // can drop in a gallery without an import statement.
    img: ({ src, alt, title }: ComponentPropsWithoutRef<"img">) => (
      <MdxImage
        src={typeof src === "string" ? src : undefined}
        alt={alt}
        title={title}
      />
    ),
    PhotoGrid,
    code: (props) => (
      <code
        className="font-mono text-[0.92em] bg-purple-50 px-1.5 py-0.5 rounded"
        {...props}
      />
    ),
    ...components,
  };
}
