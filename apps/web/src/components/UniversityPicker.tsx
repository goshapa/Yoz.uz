"use client";

import { useEffect, useState } from "react";

import { api, type UniversityOption } from "@/lib/api";
import { topicName, useI18n } from "@/lib/i18n";

const SCHOOL_VALUE = "school";

export function UniversityPicker({
  isStudent,
  onIsStudentChange,
  universityId,
  onUniversityIdChange,
}: {
  isStudent: boolean;
  onIsStudentChange: (value: boolean) => void;
  universityId: string;
  onUniversityIdChange: (value: string) => void;
}) {
  const { dict, locale } = useI18n();
  const [options, setOptions] = useState<UniversityOption[]>([]);

  useEffect(() => {
    if (!isStudent || options.length > 0) return;
    api
      .get<UniversityOption[]>("/topics/directory")
      .then(setOptions)
      .catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={isStudent}
          onChange={(e) => {
            onIsStudentChange(e.target.checked);
            if (!e.target.checked) onUniversityIdChange("");
          }}
        />
        {dict.auth.isStudent}
      </label>

      {isStudent && (
        <select
          className="input"
          value={universityId}
          onChange={(e) => onUniversityIdChange(e.target.value)}
          required
        >
          <option value="">{dict.auth.universityPlaceholder}</option>
          <option value={SCHOOL_VALUE}>{dict.auth.schoolOption}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {topicName(option, locale)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function resolveUniversityTopicId(isStudent: boolean, universityId: string): string | null {
  if (!isStudent) return null;
  if (universityId === SCHOOL_VALUE) return null;
  return universityId || null;
}
