import { useEffect, useMemo } from "react";

/**
 * A blob URL for raw image bytes, revoked when the bytes change or the
 * component unmounts.
 */
export function useAvatarUrl(
  avatar: Uint8Array | null | undefined
): string | null {
  // Copied into a fresh array because what a document hands back may be a view
  // onto it rather than a plain Uint8Array.
  const url = useMemo(
    () =>
      avatar && avatar.length > 0
        ? URL.createObjectURL(new Blob([new Uint8Array(avatar)]))
        : null,
    [avatar]
  );

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
