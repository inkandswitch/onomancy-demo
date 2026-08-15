import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
  className?: string;
  /** Play the entry animation. Keyframes are available in styles.css. */
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
  widthClassName = "kh-max-w-md",
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
      className="kh-fixed kh-inset-0 kh-z-50 kh-overflow-auto kh-bg-background/80 kh-backdrop-blur-sm kh-flex kh-items-center kh-justify-center kh-p-4 kh-transition-all kh-duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={
        animate ? { animation: "keyhive-fade-in 0.2s ease-out" } : undefined
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`kh-bg-card kh-rounded-lg kh-shadow-lg kh-border kh-border-border ${widthClassName} kh-w-full kh-max-h-[90vh] kh-overflow-auto kh-transition-all kh-duration-200 kh-transform kh-ring-1 kh-ring-ring/20 kh-ring-offset-2 kh-ring-offset-background ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={
          animate ? { animation: "keyhive-slide-in 0.2s ease-out" } : undefined
        }
      >
        <div className="kh-p-6">
          <div className="kh-flex kh-items-center kh-justify-between kh-mb-6">
            <h2 className="kh-text-xl kh-font-semibold kh-text-foreground">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="kh-text-muted-foreground hover:kh-text-foreground kh-transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="kh-w-6 kh-h-6"
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
