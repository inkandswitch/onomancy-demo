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
      <label className="kh-block kh-text-sm kh-font-medium kh-text-foreground kh-mb-2">
        {label}
      </label>
      <div className="kh-w-full kh-px-3 kh-py-2 kh-bg-muted kh-text-muted-foreground kh-rounded-md kh-text-sm kh-font-mono kh-break-all">
        {value}
      </div>
      <div className="kh-mt-2 kh-flex kh-items-center kh-gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="kh-px-3 kh-py-1.5 kh-text-sm kh-font-medium kh-text-secondary-foreground kh-bg-secondary kh-border kh-border-border kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring"
        >
          Copy to Clipboard
        </button>
        {status === "copied" && (
          <span role="status" className="kh-text-sm kh-text-muted-foreground">
            Copied
          </span>
        )}
        {status === "failed" && (
          <span role="alert" className="kh-text-sm kh-text-destructive">
            Could not copy. Select the text and copy it by hand.
          </span>
        )}
      </div>
      {help && (
        <p className="kh-mt-2 kh-text-xs kh-text-muted-foreground">{help}</p>
      )}
    </div>
  );
}
