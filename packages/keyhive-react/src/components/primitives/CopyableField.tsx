import { useEffect, useState } from "react";

export interface CopyableFieldProps {
  label: string;
  value: string;
  help?: string;
  className?: string;
}

/**
 * A read-only value with a copy button. Reports whether the copy to clipboard worked.
 */
export function CopyableField({
  label,
  value,
  help,
  className = "",
}: CopyableFieldProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}
      </label>
      <div className="w-full px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-mono break-all">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="px-3 py-1.5 text-sm font-medium text-secondary-foreground bg-secondary border border-border rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
        >
          Copy to Clipboard
        </button>
        {status === "copied" && (
          <span role="status" className="text-sm text-muted-foreground">
            Copied
          </span>
        )}
        {status === "failed" && (
          <span role="alert" className="text-sm text-destructive">
            Could not copy. Select the text and copy it by hand.
          </span>
        )}
      </div>
      {help && <p className="mt-2 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
