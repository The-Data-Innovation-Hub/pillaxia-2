import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { en, yo, ig, ha, fr, type Translations } from "./translations";
import { db } from "@/integrations/db";
import { format } from "date-fns";

// Force fresh module - v5

export type LanguageCode = "en" | "yo" | "ig" | "ha" | "fr";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "yo", name: "Yoruba", nativeName: "Èdè Yorùbá" },
  { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
];

const translations: Record<LanguageCode, Translations> = { en, fr, yo, ig, ha };

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: Translations;
  languages: Language[];
  isLoading: boolean;
  formatDate: (date: Date | string, formatStr: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "pillaxia_language";

function getInitialLanguage(): LanguageCode {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) {
      return stored as LanguageCode;
    }
    const browserLang = navigator.language.split("-")[0];
    if (browserLang in translations) {
      return browserLang as LanguageCode;
    }
  }
  return "en";
}

/**
 * LanguageProvider — fetches user language preference from the profile table.
 * Uses a lightweight approach: reads user id from the AuthContext by importing
 * useAuth lazily (to avoid circular dependency at import time).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Listen for auth state by polling AuthContext via a global event
  // (We avoid importing useAuth directly here because LanguageProvider
  //  sits *inside* AuthProvider and this avoids a context dependency issue.)
  useEffect(() => {
    // Attempt to read user id from a custom event dispatched by AuthProvider
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setUserId(detail?.userId ?? null);
    };
    window.addEventListener("pillaxia:auth-change", handler);

    // Also check for an already-set user id
    const existingUserId = (window as any).__pillaxia_userId;
    if (existingUserId) {
      setUserId(existingUserId);
    }

    return () => window.removeEventListener("pillaxia:auth-change", handler);
  }, []);

  // When we know the user, fetch their language preference
  useEffect(() => {
    if (!userId) return;
    db
      .from("profiles")
      .select("language_preference")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { language_preference?: string } | null }) => {
        if (data?.language_preference && data.language_preference in translations) {
          const profileLang = data.language_preference as LanguageCode;
          if (profileLang !== language) {
            setLanguageState(profileLang);
            localStorage.setItem(STORAGE_KEY, profileLang);
          }
        }
      });
  }, [userId]);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setIsLoading(true);
    try {
      setLanguageState(lang);
      localStorage.setItem(STORAGE_KEY, lang);

      if (userId) {
        const { error } = await db
          .from("profiles")
          .update({ language_preference: lang })
          .eq("user_id", userId);

        if (error) {
          console.error("Failed to save language preference:", error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const formatDateFn = useCallback((date: Date | string, formatStr: string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, formatStr);
  }, []);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    languages: SUPPORTED_LANGUAGES,
    isLoading,
    formatDate: formatDateFn,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    console.warn("useLanguage called outside LanguageProvider - using fallback");
    return {
      language: "en" as LanguageCode,
      setLanguage: async () => {},
      t: en,
      languages: SUPPORTED_LANGUAGES,
      isLoading: false,
      formatDate: (date: Date | string, formatStr: string) => {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return format(dateObj, formatStr);
      },
    };
  }
  return context;
}
