import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
  className?: string;
  /** Play the `fadeIn` and `slideIn` keyframes if the app defines them. */
  animate?: boolean;
}

/**
 * Dialog modal with backdrop, close button, Escape and click-outside to dismiss,
 * and a scroll lock on the body.
 *
 * Kept separate from the views so they can also be embedded in a page.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  widthClassName = "max-w-md",
  className = "",
  animate = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={animate ? { animation: "fadeIn 0.2s ease-out" } : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-card rounded-lg shadow-lg border border-border ${widthClassName} w-full max-h-[90vh] overflow-auto transition-all duration-200 transform ring-1 ring-ring/20 ring-offset-2 ring-offset-background ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={animate ? { animation: "slideIn 0.2s ease-out" } : undefined}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
