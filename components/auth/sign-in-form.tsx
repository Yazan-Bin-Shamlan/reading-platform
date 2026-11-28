"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent" | "error" | "limit";

/** Supabase's built-in mail service sends only a few sign-in emails an hour. */
const isRateLimit = (e: { status?: number; code?: string }) => e.status === 429 || e.code === "over_email_send_rate_limit";

export function SignInForm({
  next,
  initialError,
  google,
}: {
  next: string;
  initialError: boolean;
  google: boolean;
}) {
  const t = useTranslations("auth");
  const [state, setState] = useState<State>(initialError ? "error" : "idle");
  const callback = () =>
    `${location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    setState(!error ? "sent" : isRateLimit(error) ? "limit" : "error");
  }

  async function withGoogle() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) setState("error");
  }

  if (state === "sent") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
        <MailCheck className="size-6 text-brand" aria-hidden />
        <p>{t("checkEmail")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {google && (
        <>
          <Button type="button" variant="outline" size="lg" className="h-11 w-full" onClick={withGoogle}>
            {t("continueWithGoogle")}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={sendLink} className="space-y-3">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          required
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          className="h-11"
        />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={state === "sending"}>
          {state === "sending" && <Loader2 className="animate-spin" aria-hidden />}
          {state === "sending" ? t("sending") : t("sendLink")}
        </Button>
        {(state === "error" || state === "limit") && (
          <p role="alert" className="text-sm text-destructive">
            {t(state === "limit" ? "rateLimited" : "error")}
          </p>
        )}
      </form>
    </div>
  );
}
