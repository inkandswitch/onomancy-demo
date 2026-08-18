import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Track a right-click menu for a list of rows.
 *
 * Returns the state to pass to {@link ContextMenu}, an `open` for a row's
 * `onContextMenu`, and a `close`.
 */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const open = (event: React.MouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    // A right-click also selects the row underneath without this.
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  };

  return { menu, open, close: () => setMenu(null) };
}

/**
 * A menu at a point on screen, dismissed by choosing something, clicking away,
 * pressing Escape, or anything that moves what it is pointing at.
 *
 * In a portal so the sidebar's `overflow-y-auto` cannot clip it.
 */
export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Nudged back on screen once its size is known, so a click near an edge does
  // not put the menu half outside the window.
  useEffect(() => {
    if (!state || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPosition({
      x: Math.min(state.x, window.innerWidth - width - 8),
      y: Math.min(state.y, window.innerHeight - height - 8),
    });
  }, [state]);

  useEffect(() => {
    if (!state) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture, because the scroll that matters happens in the sidebar rather
    // than on the window.
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [state, onClose]);

  if (!state) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ top: position.y, left: position.x }}
      // bg-secondary rather than bg-card or bg-popover: both of those are the
      // same value as the background in this theme, so the menu would have no
      // surface of its own against the sidebar.
      className="fixed z-50 min-w-44 py-1 rounded-md border border-border bg-secondary shadow-lg"
    >
      {state.items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          autoFocus={item === state.items[0]}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className="w-full text-left px-3 py-2 text-sm text-secondary-foreground bg-transparent border-none cursor-pointer transition-colors hover:bg-foreground/10 focus:bg-foreground/10 focus:outline-none"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
