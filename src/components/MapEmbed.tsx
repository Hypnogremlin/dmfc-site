type MapEmbedProps = {
  bbox: string;
  marker: string;
  title?: string;
  className?: string;
};

export function MapEmbed({
  bbox,
  marker,
  title = "Map",
  className = "",
}: MapEmbedProps) {
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  return (
    <div className={`relative w-full overflow-hidden border border-brass/25 ${className}`}>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block w-full aspect-[4/3] grayscale-[60%]"
      />
    </div>
  );
}
