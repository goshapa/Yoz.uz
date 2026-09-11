"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Section = { heading: string; body: string };

export function LegalPage({ title, sections }: { title: string; sections: Section[] }) {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return (
    <AppShell user={user}>
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="rounded-lg bg-black/5 p-3 text-xs text-[var(--fg-muted)] dark:bg-white/5">
          {dict.legal.draftNotice}
        </p>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-1 text-sm font-semibold">{section.heading}</h2>
            <p className="text-sm text-[var(--fg-muted)]">{section.body}</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
