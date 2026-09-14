// Фиксированный набор матовых цветов для плейсхолдера — выбираем один по хешу имени.
// Классы должны быть статичными строками, чтобы JIT-компилятор Tailwind их не выпилил.
const PLACEHOLDER_COLORS = [
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-accent-500",
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

export function Avatar({
  src,
  name,
  size = 40,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, aspectRatio: "1 / 1" }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ${pickColor(name || "?")}`}
      style={{ width: size, height: size, aspectRatio: "1 / 1", fontSize: size * 0.4 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
