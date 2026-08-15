import { useAvatarUrl } from "../../hooks/useAvatarUrl";

export interface AvatarProps {
  avatar?: Uint8Array | null;
  /** Alt text, and the source of the initial shown when there is no image. */
  name?: string;
  sizeClassName?: string;
  /** Image to fall back to instead of an initial. */
  fallbackSrc?: string;
  className?: string;
}

/** An abbreviated hex id is not a name and shouldn't be used for an initial. */
function isAbbreviatedId(label: string): boolean {
  return /^0x[0-9a-f]/i.test(label);
}

/** A peer's avatar or a placeholder. */
export function Avatar({
  avatar,
  name,
  sizeClassName = "w-8 h-8",
  fallbackSrc,
  className = "",
}: AvatarProps) {
  const url = useAvatarUrl(avatar);
  const src = url ?? fallbackSrc;
  const label = name?.trim() || "Unnamed peer";

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`${sizeClassName} rounded-full object-cover ${className}`}
      />
    );
  }

  const named = !isAbbreviatedId(label) && /^[\p{L}\p{N}]/u.test(label);

  return (
    <div
      role="img"
      aria-label={label}
      className={`${sizeClassName} rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium select-none ${className}`}
    >
      {named ? label[0].toUpperCase() : "?"}
    </div>
  );
}
