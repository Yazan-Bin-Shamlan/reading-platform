import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";

type Section = { title: string; body: string[] };

/** The Privacy and Terms pages: sections from messages (legal.<page>), plus how to reach us. */
export async function LegalPage({ page }: { page: "privacy" | "terms" }) {
  const t = await getTranslations("legal");
  const sections = t.raw(`${page}.sections`) as Section[];
  const contact = process.env.APP_CONTACT?.trim();
  return (
    <article className="max-w-2xl">
      <PageHeader title={t(`${page}.title`)} />
      <p className="text-sm text-muted-foreground">{t("updated", { date: "2026-11-28" })}</p>
      <div className="mt-8 space-y-8 leading-relaxed">
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="font-serif text-xl font-semibold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-semibold">{t("contactTitle")}</h2>
          <p>
            {contact ? (
              <>
                {t("contactAt")}{" "}
                <a href={contact.includes("@") ? `mailto:${contact}` : contact} dir="ltr" className="font-medium underline underline-offset-2">
                  {contact}
                </a>
              </>
            ) : (
              t("contactFallback")
            )}
          </p>
        </section>
      </div>
    </article>
  );
}
