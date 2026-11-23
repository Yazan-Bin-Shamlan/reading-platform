"use client";

import { Upload } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useStartUpload } from "./upload-context";

export function UploadButton({ children, ...props }: ComponentProps<typeof Button>) {
  const start = useStartUpload();
  return (
    <Button {...props} onClick={start}>
      <Upload aria-hidden />
      {children}
    </Button>
  );
}
