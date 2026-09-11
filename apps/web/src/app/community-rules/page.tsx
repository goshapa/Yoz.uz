"use client";

import { LegalPage } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

export default function CommunityRulesPage() {
  const { dict } = useI18n();
  return <LegalPage title={dict.legal.communityRules.title} sections={dict.legal.communityRules.sections} />;
}
