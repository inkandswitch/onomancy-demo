export interface AccessBadgeProps {
  /** Access level's string representation. */
  access: string;
  className?: string;
}

/**
 * An access level.
 *
 * Takes a string rather than an `Access` because every WASM call returns a
 * fresh instance, which React cannot compare.
 */
export function AccessBadge({ access, className = "" }: AccessBadgeProps) {
  return (
    <span
      className={`kh-inline-block kh-px-2 kh-py-0.5 kh-rounded kh-text-xs kh-font-medium kh-uppercase kh-tracking-wide kh-bg-muted kh-text-muted-foreground kh-border kh-border-border ${className}`}
    >
      {access}
    </span>
  );
}
