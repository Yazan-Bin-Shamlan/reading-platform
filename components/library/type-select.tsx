"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { itemTypes, type ItemType } from "@/lib/library/schemas";

export async function patchDocument(id: string, data: { type?: ItemType; title?: string }) {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("update failed");
}

/** Compact type picker shown on upload items and library cards. */
export function TypeSelect({ value, onChange }: { value: ItemType; onChange: (t: ItemType) => void }) {
  const t = useTranslations("types");
  const label = useTranslations("upload")("typeLabel");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="xs" aria-label={`${label}: ${t(value)}`}>
          {t(value)}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {itemTypes.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => onChange(type)}>
            <span className="flex-1">{t(type)}</span>
            {type === value && <Check aria-hidden className="text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
