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
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide bg-muted text-muted-foreground border border-border ${className}`}
    >
      {access}
    </span>
  );
}
