import { Icon } from "@/components/icons";

export function FounderBadge({
  size = 10,
  variant = "icon",
  label,
}: {
  size?: number;
  variant?: "icon" | "full";
  label?: string;
}) {
  if (variant === "full") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-3 py-1 text-xs font-bold text-amber-950 shadow-md shadow-amber-500/40 ring-1 ring-amber-300/70 dark:shadow-amber-900/40">
        <Icon name="crown" filled size={13} className="text-amber-950 drop-shadow-sm" />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 ring-1 ring-amber-300/60"
      style={{ width: size * 1.55, height: size * 1.55, padding: size * 0.28 }}
      title={label ?? "Основатель Yoz"}
      aria-label={label ?? "Основатель Yoz"}
    >
      <Icon name="crown" filled size={size} className="text-white drop-shadow-sm" />
    </span>
  );
}
