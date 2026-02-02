import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { en, yo, ig, ha, fr, type Translations } from "./translations";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user session independently to avoid circular dependency with AuthContext
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      
      // Fetch language preference from profile if user is logged in
      if (session?.user?.id) {
        supabase
          .from("profiles")
          .select("language_preference")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.language_preference && data.language_preference in translations) {
              const profileLang = data.language_preference as LanguageCode;
              if (profileLang !== language) {
                setLanguageState(profileLang);
                localStorage.setItem(STORAGE_KEY, profileLang);
              }
            }
          });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
      
      if (session?.user?.id) {
        supabase
          .from("profiles")
          .select("language_preference")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.language_preference && data.language_preference in translations) {
              const profileLang = data.language_preference as LanguageCode;
              setLanguageState(profileLang);
              localStorage.setItem(STORAGE_KEY, profileLang);
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setIsLoading(true);
    try {
      // Update local state immediately
      setLanguageState(lang);
      localStorage.setItem(STORAGE_KEY, lang);

      // If user is logged in, persist to database
      if (userId) {
        const { error } = await supabase
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
