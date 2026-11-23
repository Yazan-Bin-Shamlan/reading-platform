import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { BrandMark } from "@/components/shell/brand-mark";
import { safeNext } from "@/lib/auth";
import { supabaseConfig } from "@/lib/supabase/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signIn") };
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, `/${locale}`);
  const t = await getTranslations("auth");

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <BrandMark />
        </div>
        <h1 className="text-center font-serif text-3xl font-semibold tracking-tight">{t("signInTitle")}</h1>
        <p className="mt-3 text-center leading-relaxed text-muted-foreground">{t("signInBody")}</p>
        <div className="mt-8">
          {supabaseConfig ? (
            <SignInForm
              next={next}
              initialError={sp.error === "1"}
              google={process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true"}
            />
          ) : (
            <p role="status" className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
              {t("notConfigured")}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
