import { Icon } from "@/components/icons";

export function FounderBadge({ size = 10 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 ring-1 ring-amber-300/60"
      style={{ width: size * 1.55, height: size * 1.55, padding: size * 0.28 }}
      title="Основатель Yoz"
      aria-label="Основатель Yoz"
    >
      <Icon name="crown" filled size={size} className="text-white drop-shadow-sm" />
    </span>
  );
}
