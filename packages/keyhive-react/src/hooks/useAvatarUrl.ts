import { useEffect, useState } from "react";

/**
 * A blob URL for raw image bytes, revoked when the bytes change or the
 * component unmounts.
 */
export function useAvatarUrl(
  avatar: Uint8Array | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatar || avatar.length === 0) {
      setUrl(null);
      return;
    }
    // Copied into a fresh array because what a document returns may be a
    // view rather than a plain Uint8Array.
    const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(avatar)]));
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [avatar]);

  return url;
}
