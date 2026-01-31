// Hausa translations - extends English with Hausa overrides
import { en, type Translations } from "./en";

export const ha: Translations = {
  ...en,
  common: { ...en.common, loading: "Ana lodi...", save: "Ajiye", cancel: "Soke", delete: "Share", yes: "E", no: "A'a", today: "Yau", there: "kai", getStarted: "Fara", comingSoon: "Yana zuwa nan ba da jimawa ba" },
  greetings: { morning: "Barka da safe", afternoon: "Barka da rana", evening: "Barka da yamma" },
  nav: { ...en.nav, home: "Gida", dashboard: "Dashboard", medications: "Magunguna", settings: "Saituna" },
  dashboard: { ...en.dashboard, welcome: "Barka da dawowa", quickActions: "Ayyuka Cikin Sauri" },
  medications: { ...en.medications, title: "Magunguna", addMedication: "Ƙara Magani", noMedications: "Babu magunguna tukuna" },
  schedule: { ...en.schedule, title: "Jadawali", taken: "An sha", missed: "An rasa" },
  angela: { ...en.angela, askAngela: "Tambayi Angela", openAssistant: "Buɗe mataimakin AI Angela" },
  notifications: { ...en.notifications, setupTitle: "Saita sanarwar ka", setupDescription: "Tsara yadda za ka karɓi tunatarwar magani" },
  appointments: { ...en.appointments, upcoming: "Alƙawura Masu Zuwa", noUpcoming: "Babu alƙawura masu zuwa", moreAppointments: "ƙarin alƙawura", confirmed: "An tabbatar da alƙawari", cancelled: "An soke alƙawari", updateFailed: "Ba a iya sabunta ba" },
  clinician: { ...en.clinician, dashboardTitle: "Dashboard Likita", dashboardSubtitle: "Lura da bin dokokin magani" },
  pharmacist: { ...en.pharmacist, dashboardTitle: "Dashboard Magani", dashboardSubtitle: "Sarrafa takardun magani da kayan ajiya" },
  admin: { ...en.admin, dashboardTitle: "Dashboard Mai Gudanarwa", dashboardSubtitle: "Taƙaitawar tsari da gudanarwa" },
  health: { ...en.health, symptoms: { title: "Alamomi", logSymptom: "Rubuta Alama" } },
  offline: { ...en.offline, showingCachedData: "Ana nuna bayanan da aka adana" },
};
