"use client";

import { LegalPage } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { dict } = useI18n();
  return <LegalPage title={dict.legal.privacy.title} sections={dict.legal.privacy.sections} />;
}
