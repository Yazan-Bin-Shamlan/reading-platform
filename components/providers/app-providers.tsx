"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Direction } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechNotices } from "./speech-notices";

export function AppProviders({
  dir,
  children,
}: {
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <Direction.Provider dir={dir}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} dir={dir} />
          <SpeechNotices />
        </TooltipProvider>
      </QueryClientProvider>
    </Direction.Provider>
  );
}
