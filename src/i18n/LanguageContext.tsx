import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { en, yo, ig, ha, type Translations } from "./translations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LanguageCode = "en" | "yo" | "ig" | "ha";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "yo", name: "Yoruba", nativeName: "Èdè Yorùbá" },
  { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
];

const translations: Record<LanguageCode, Translations> = { en, yo, ig, ha };

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: Translations;
  languages: Language[];
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "pillaxia_language";

function getInitialLanguage(): LanguageCode {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in translations) {
    return stored as LanguageCode;
  }
  
  // Check browser language
  const browserLang = navigator.language.split("-")[0];
  if (browserLang in translations) {
    return browserLang as LanguageCode;
  }
  
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isLoading, setIsLoading] = useState(false);

  // Sync language from user profile on login
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
      // Update local state immediately
      setLanguageState(lang);
      localStorage.setItem(STORAGE_KEY, lang);

      // If user is logged in, persist to database
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ language_preference: lang })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save language preference:", error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    languages: SUPPORTED_LANGUAGES,
    isLoading,
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
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
