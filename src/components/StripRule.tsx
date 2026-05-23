export function StripRule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-px w-full bg-brass/40 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass" />
    </div>
  );
}
