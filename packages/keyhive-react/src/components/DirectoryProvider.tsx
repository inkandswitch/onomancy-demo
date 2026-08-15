import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DirectoryContext } from "../directory/context";
import type { NameDirectory } from "../directory/types";

export interface DirectoryProviderProps {
  directory: NameDirectory;
  children: ReactNode;
}

/** Puts a directory in scope for every component below it. */
export function DirectoryProvider({
  directory,
  children,
}: DirectoryProviderProps) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!directory.subscribe) return;
    return directory.subscribe(() => setVersion((v) => v + 1));
  }, [directory]);

  const value = useMemo(() => ({ directory, version }), [directory, version]);

  return (
    <DirectoryContext.Provider value={value}>
      {children}
    </DirectoryContext.Provider>
  );
}
