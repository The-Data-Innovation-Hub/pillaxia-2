// Igbo translations - extends English with Igbo overrides
import { en, type Translations } from "./en";

export const ig: Translations = {
  ...en,
  common: { ...en.common, loading: "Na-ebugo...", save: "Chekwaa", cancel: "Kagbuo", delete: "Hichapụ", yes: "Ee", no: "Mba", today: "Taa", there: "ị nọ", getStarted: "Malite", comingSoon: "Na-abịa n'oge na-adịghị anya" },
  greetings: { morning: "Ụtụtụ ọma", afternoon: "Ehihie ọma", evening: "Mgbede ọma" },
  nav: { ...en.nav, home: "Ụlọ", dashboard: "Pánẹlụ", medications: "Ọgwụ", settings: "Ntọala" },
  dashboard: { ...en.dashboard, welcome: "Nnọọ azụ", quickActions: "Omume Ngwa ngwa" },
  medications: { ...en.medications, title: "Ọgwụ", addMedication: "Tinye Ọgwụ", noMedications: "Enweghị ọgwụ ọ bụla" },
  schedule: { ...en.schedule, title: "Usoro", taken: "Ewere", missed: "Tụfuru" },
  angela: { ...en.angela, askAngela: "Jụọ Angela", openAssistant: "Mepee onye enyemaka AI Angela" },
  notifications: { ...en.notifications, setupTitle: "Tọọ ọkwa gị", setupDescription: "Hazie otú ị ga-esi nata ncheta ọgwụ" },
  appointments: { ...en.appointments, upcoming: "Ọkọwa Oge Na-abịa", noUpcoming: "Enweghị ọkọwa oge na-abịa", moreAppointments: "ọkọwa oge ndị ọzọ", confirmed: "Ekwenyere ọkọwa oge", cancelled: "Akagburu ọkọwa oge", updateFailed: "Enweghị ike ịmelite" },
  clinician: { ...en.clinician, dashboardTitle: "Pánẹlụ Dọkịta", dashboardSubtitle: "Lelee ịgbaso ọgwụ ọrịa" },
  pharmacist: { ...en.pharmacist, dashboardTitle: "Pánẹlụ Ọgwụ", dashboardSubtitle: "Jikwaa ozi ọgwụ na ihe dị n'ụlọ" },
  admin: { ...en.admin, dashboardTitle: "Pánẹlụ Onye Nlekọta", dashboardSubtitle: "Nchịkọta usoro na njikwa" },
  health: { ...en.health, symptoms: { title: "Mgbaàmà", logSymptom: "Dee Mgbaàmà" } },
  offline: { ...en.offline, showingCachedData: "Na-egosi data echekwara" },
};
