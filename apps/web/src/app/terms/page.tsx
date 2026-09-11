"use client";

import { LegalPage } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { dict } = useI18n();
  return <LegalPage title={dict.legal.terms.title} sections={dict.legal.terms.sections} />;
}
