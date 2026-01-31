// Yoruba translations - extends English with Yoruba overrides
import { en, type Translations } from "./en";

export const yo: Translations = {
  ...en,
  common: { ...en.common, loading: "Ń ṣiṣẹ́...", save: "Fipamọ́", cancel: "Fagilé", delete: "Paárẹ́", yes: "Bẹ́ẹ̀ni", no: "Bẹ́ẹ̀kọ́", today: "Lónìí", there: "ìwọ", getStarted: "Bẹ̀rẹ̀", comingSoon: "Ó ń bọ̀ láìpẹ́" },
  greetings: { morning: "Ẹ káàárọ̀", afternoon: "Ẹ káàsán", evening: "Ẹ kú ìrọ̀lẹ́" },
  nav: { ...en.nav, home: "Ilé", dashboard: "Pánẹ́lì", medications: "Òògùn", settings: "Ètò" },
  dashboard: { ...en.dashboard, welcome: "Ẹ káàbọ̀ padà", quickActions: "Ìṣe Kíákíá" },
  medications: { ...en.medications, title: "Òògùn", addMedication: "Ṣàfikún Òògùn", noMedications: "Kò sí òògùn síbẹ̀" },
  schedule: { ...en.schedule, title: "Àkójọ Àsìkò", taken: "Ti Mu", missed: "Ti Pàdánù" },
  angela: { ...en.angela, askAngela: "Béèrè lọ́wọ́ Angela", openAssistant: "Ṣí ẹlẹ́gẹ̀ẹ́ AI Angela" },
  notifications: { ...en.notifications, setupTitle: "Ṣètò ìfitónilétí rẹ", setupDescription: "Ṣètò bí o ṣe fẹ́ gba ìránlétí òògùn" },
  appointments: { ...en.appointments, upcoming: "Ìpàdé Tó Ń Bọ̀", noUpcoming: "Kò sí ìpàdé tó ń bọ̀", moreAppointments: "ìpàdé míràn", confirmed: "A ti jẹ́rìísí ìpàdé", cancelled: "A ti fagilé ìpàdé", updateFailed: "Kò le ṣàtúnṣe ìpàdé" },
  clinician: { ...en.clinician, dashboardTitle: "Pánẹ́lì Dọ́kítà", dashboardSubtitle: "Ṣàkíyèsí ìtẹ̀lé òògùn aláìsàn" },
  pharmacist: { ...en.pharmacist, dashboardTitle: "Pánẹ́lì Oníṣègùn", dashboardSubtitle: "Ṣàkóso ìwé òògùn àti àkójọ" },
  admin: { ...en.admin, dashboardTitle: "Pánẹ́lì Alábòójútó", dashboardSubtitle: "Àkópọ̀ àti ìṣàkóso ètò" },
  health: { ...en.health, symptoms: { title: "Àmì Àìsàn", logSymptom: "Kọ Àmì Àìsàn" } },
  offline: { ...en.offline, showingCachedData: "Ń ṣe àfihàn dátà tí a fipamọ́" },
};
