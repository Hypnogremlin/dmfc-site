import path from "node:path";
import Image from "next/image";
import sharp from "sharp";

interface MdxImageProps {
  src?: string;
  alt?: string;
  title?: string;
}

// Renders Markdown images (`![alt](/news-images/... "Optional caption")`)
// inside MDX bodies. Local images are measured at build time with sharp so
// next/image gets real intrinsic dimensions (required for a string `src` —
// see node_modules/next/dist/docs .../02-components/image.md) and the page
// reserves space with no layout shift. The optional Markdown title renders
// as a caption.
//
// Uses block-styled <span>s rather than <figure>/<figcaption> because MDX
// wraps a lone image in a <p>, and <figure> is invalid inside <p>.
export async function MdxImage({ src, alt = "", title }: MdxImageProps) {
  // Remote or unresolvable images fall back to a plain styled <img>.
  if (!src || !src.startsWith("/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="my-8 w-full" loading="lazy" />;
  }

  const file = path.join(process.cwd(), "public", src);
  const { width, height } = await sharp(file).metadata();
  if (!width || !height) {
    throw new Error(`MdxImage: could not read dimensions of ${src}`);
  }

  return (
    <span className="my-8 block">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 768px"
        className="h-auto w-full"
      />
      {title && (
        <span className="mt-3 block text-sm text-mute">{title}</span>
      )}
    </span>
  );
}
