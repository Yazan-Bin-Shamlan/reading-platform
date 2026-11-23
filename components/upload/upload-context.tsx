"use client";

import { createContext, use } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useUploads } from "@/lib/upload/store";

export const SignedInContext = createContext(false);

/** Opens the file picker, or sends signed-out visitors to sign in first. */
export function useStartUpload() {
  const signedIn = use(SignedInContext);
  const openPicker = useUploads((s) => s.openPicker);
  const router = useRouter();
  const pathname = usePathname();
  return () => (signedIn ? openPicker() : router.push(`/sign-in?next=${encodeURIComponent(pathname)}`));
}
