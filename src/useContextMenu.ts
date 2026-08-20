import { useState } from "react";

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
 * Returns the state to pass to `ContextMenu`, an `open` for a row's
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
