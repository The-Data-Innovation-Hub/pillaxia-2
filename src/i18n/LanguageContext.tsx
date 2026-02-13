import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { en, yo, ig, ha, fr, type Translations } from "./translations";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { updateMeProfile } from "@/integrations/azure/data";

// Force fresh module - v4

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
  // Check localStorage first
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) {
      return stored as LanguageCode;
    }
    
    // Check browser language
    const browserLang = navigator.language.split("-")[0];
    if (browserLang in translations) {
      return browserLang as LanguageCode;
    }
  }
  
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isLoading, setIsLoading] = useState(false);

  // Sync language from profile when logged in (Azure/Entra; profile from /api/me)
  useEffect(() => {
    if (profile?.language_preference && profile.language_preference in translations) {
      const profileLang = profile.language_preference as LanguageCode;
      if (profileLang !== language) {
        setLanguageState(profileLang);
        localStorage.setItem(STORAGE_KEY, profileLang);
      }
    }
  }, [profile?.language_preference]);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setIsLoading(true);
    try {
      setLanguageState(lang);
      localStorage.setItem(STORAGE_KEY, lang);

      if (profile?.user_id) {
        try {
          await updateMeProfile({ language_preference: lang });
        } catch (error) {
          console.error("Failed to save language preference:", error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [profile?.user_id]);

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
    // Return a safe fallback instead of throwing during initialization edge cases
    // This prevents crashes when components render before the provider is ready
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
