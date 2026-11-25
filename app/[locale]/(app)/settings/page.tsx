import { getTranslations } from "next-intl/server";
import { getProvider } from "@/lib/ai/provider";
import { VoiceSettings } from "@/components/settings/voice-settings";
import { PageHeader } from "@/components/shell/page-header";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemePicker } from "@/components/shell/theme-picker";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tSpeech = await getTranslations("speech");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("title")} />
      <section className="space-y-6 rounded-2xl border bg-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">{t("appearance")}</h2>
        <div className="space-y-3">
          <p className="font-medium">{t("theme")}</p>
          <ThemePicker />
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">{t("language")}</p>
          <LanguageSwitch />
        </div>
      </section>
      <section className="mt-6 space-y-6 rounded-2xl border bg-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">{tSpeech("title")}</h2>
        <VoiceSettings aiAvailable={Boolean((await getProvider())?.speak)} />
      </section>
    </div>
  );
}
