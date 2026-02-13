/**
 * Azure data layer – replaces Supabase table/RPC access.
 * Backend must expose REST endpoints under VITE_API_URL / VITE_AZURE_FUNCTIONS_URL.
 * Convention: GET /api/:resource?query, POST /api/:resource, PATCH /api/:resource/:id, DELETE /api/:resource/:id.
 */

import { apiGet, apiPost, apiPatch, apiPut, apiDelete, apiInvoke, apiUpload } from "./client";

// --- Profiles ---
export async function getProfileByUserId(userId: string) {
  const { data, error } = await apiGet<{ id: string; user_id: string; organization_id?: string; [k: string]: unknown }>(
    "/api/profiles",
    { user_id: userId }
  );
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function listProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await apiGet<unknown[]>("/api/profiles", { user_ids: userIds.join(",") });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** Admin: list all profiles. */
export async function listProfiles() {
  const { data, error } = await apiGet<unknown[]>("/api/profiles");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { data, error } = await apiPatch<unknown>("/api/profiles", { user_id: userId, ...updates });
  if (error) throw error;
  return data;
}

/** Update current user profile (e.g. language_preference). Uses PATCH /api/me. */
export async function updateMeProfile(updates: Record<string, unknown>) {
  const { data, error } = await apiPatch<unknown>("/api/me", updates);
  if (error) throw error;
  return data;
}

// --- Organizations ---
export async function listOrganizations() {
  const { data, error } = await apiGet<unknown[]>("/api/organizations");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function getOrganization(id: string) {
  const { data, error } = await apiGet<Record<string, unknown>>(`/api/organizations/${id}`);
  if (error) throw error;
  return data;
}

export async function createOrganization(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown> & { id?: string }>("/api/organizations", payload);
  if (error) throw error;
  return data;
}

export async function updateOrganization(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/organizations/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deleteOrganization(id: string) {
  const { error } = await apiDelete(`/api/organizations/${id}`);
  if (error) throw error;
}

export async function listOrganizationMembersByUser(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/organization-members", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function addOrganizationMember(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/organization-members", payload);
  if (error) throw error;
  return data;
}

export async function listOrganizationMembersByOrg(organizationId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/organization-members", { organization_id: organizationId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updateOrganizationMember(memberId: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/organization-members/${memberId}`, payload);
  if (error) throw error;
  return data;
}

export async function getOrganizationBranding(organizationId: string) {
  const { data, error } = await apiGet<Record<string, unknown> | null>("/api/organization-branding", {
    organization_id: organizationId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function upsertOrganizationBranding(payload: Record<string, unknown>) {
  const { data, error } = await apiPut<Record<string, unknown>>("/api/organization-branding", payload);
  if (error) throw error;
  return data;
}

export async function listOrganizationInvoices(organizationId: string, limit?: number) {
  const params: Record<string, string> = { organization_id: organizationId };
  if (limit != null) params.limit = String(limit);
  const { data, error } = await apiGet<unknown[]>("/api/organization-invoices", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** Upload organization logo; backend returns { url }. Then call upsertOrganizationBranding with logo_url. */
export async function uploadOrganizationLogo(organizationId: string, file: File) {
  const { data, error } = await apiUpload<{ url: string }>(
    `/api/organization-branding/logo?organization_id=${encodeURIComponent(organizationId)}`,
    file,
    "file"
  );
  if (error) throw error;
  return data?.url;
}

// --- Medications ---
export async function listMedications(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/medications", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** For pharmacist view: list all medications (backend may filter by pharmacy). */
export async function listMedicationsForPharmacist() {
  const { data, error } = await apiInvoke<unknown[]>("pharmacist-list-medications", {});
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createMedication(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/medications", payload);
  if (error) throw error;
  return data;
}

export async function updateMedication(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/medications/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deleteMedication(id: string) {
  const { error } = await apiDelete(`/api/medications/${id}`);
  if (error) throw error;
}

// --- Medication schedules (often embedded with medications) ---
export async function listMedicationSchedules(medicationId?: string, userId?: string) {
  const q: Record<string, string> = {};
  if (medicationId) q.medication_id = medicationId;
  if (userId) q.user_id = userId;
  const { data, error } = await apiGet<unknown[]>("/api/medication-schedules", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Medication logs ---
export async function listMedicationLogs(
  userId: string,
  options?: { from?: string; to?: string }
) {
  const params: Record<string, string> = { user_id: userId };
  if (options?.from) params.from = options.from;
  if (options?.to) params.to = options.to;
  const { data, error } = await apiGet<unknown[]>("/api/medication-logs", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updateMedicationLog(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/medication-logs/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function insertMedicationLogs(payload: unknown[]) {
  const { data, error } = await apiPost<unknown>("/api/medication-logs/bulk", payload);
  if (error) throw error;
  return data;
}

// --- Symptom entries ---
export async function listSymptomEntries(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/symptom-entries", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createSymptomEntry(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/symptom-entries", payload);
  if (error) throw error;
  return data;
}

export async function deleteSymptomEntry(id: string) {
  const { error } = await apiDelete(`/api/symptom-entries/${id}`);
  if (error) throw error;
}

// --- Prescriptions ---
export async function listPrescriptions(filters?: {
  user_id?: string;
  clinician_user_id?: string;
  pharmacy_id?: string;
  pharmacy_ids?: string[];
  status?: string[];
}) {
  const params: Record<string, string> = {};
  if (filters?.user_id) params.user_id = filters.user_id;
  if (filters?.clinician_user_id) params.clinician_user_id = filters.clinician_user_id;
  if (filters?.pharmacy_id) params.pharmacy_id = filters.pharmacy_id;
  if (filters?.pharmacy_ids?.length) params.pharmacy_ids = filters.pharmacy_ids.join(",");
  if (filters?.status?.length) params.status = filters.status.join(",");
  const { data, error } = await apiGet<unknown[]>("/api/prescriptions", Object.keys(params).length ? params : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function getPrescription(id: string) {
  const { data, error } = await apiGet<Record<string, unknown>>(`/api/prescriptions/${id}`);
  if (error) throw error;
  return data;
}

export async function generatePrescriptionNumber(): Promise<string> {
  const { data, error } = await apiInvoke<string | { prescription_number?: string }>("generate-prescription-number", {});
  if (error) throw error;
  if (typeof data === "string") return data;
  if (data && typeof (data as { prescription_number?: string }).prescription_number === "string") {
    return (data as { prescription_number: string }).prescription_number;
  }
  throw new Error("Invalid prescription number response");
}

export async function createPrescription(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/prescriptions", payload);
  if (error) throw error;
  return data;
}

export async function updatePrescription(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/prescriptions/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deletePrescription(id: string) {
  const { error } = await apiDelete(`/api/prescriptions/${id}`);
  if (error) throw error;
}

export async function insertPrescriptionStatusHistory(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<unknown>("/api/prescription-status-history", payload);
  if (error) throw error;
  return data;
}

export async function listPrescriptionStatusHistory(prescriptionId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/prescription-status-history", {
    prescription_id: prescriptionId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Patient risk flags ---
export async function listPatientRiskFlags(filters?: { is_resolved?: boolean }) {
  const params: Record<string, string> = {};
  if (filters?.is_resolved !== undefined) params.is_resolved = String(filters.is_resolved);
  const { data, error } = await apiGet<unknown[]>("/api/patient-risk-flags", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updatePatientRiskFlag(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/patient-risk-flags/${id}`, payload);
  if (error) throw error;
}

// --- Polypharmacy warnings ---
export async function listPolypharmacyWarnings(patientUserIds: string[]) {
  if (!patientUserIds.length) return [];
  const { data, error } = await apiGet<unknown[]>("/api/polypharmacy-warnings", {
    patient_user_ids: patientUserIds.join(","),
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updatePolypharmacyWarning(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/polypharmacy-warnings/${id}`, payload);
  if (error) throw error;
}

// --- User roles ---
export async function listUserRoles(filters?: { user_id?: string; role?: string }) {
  const { data, error } = await apiGet<unknown[]>("/api/user-roles", filters as Record<string, string>);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function addUserRole(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/user-roles", payload);
  if (error) throw error;
  return data;
}

export async function removeUserRole(userId: string, role: string) {
  const { error } = await apiDelete(
    `/api/user-roles?user_id=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`
  );
  if (error) throw error;
}

// --- Appointments ---
export async function listClinicianPatientAssignments(clinicianUserId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/clinician-patient-assignments", {
    clinician_user_id: clinicianUserId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createClinicianPatientAssignment(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/clinician-patient-assignments", payload);
  if (error) throw error;
  return data;
}

export async function deleteClinicianPatientAssignment(assignmentId: string) {
  const { error } = await apiDelete(`/api/clinician-patient-assignments/${assignmentId}`);
  if (error) throw error;
}

export async function deleteClinicianPatientAssignmentByPatient(clinicianUserId: string, patientUserId: string) {
  const { error } = await apiDelete(
    `/api/clinician-patient-assignments?clinician_user_id=${encodeURIComponent(clinicianUserId)}&patient_user_id=${encodeURIComponent(patientUserId)}`
  );
  if (error) throw error;
}

export async function listAppointments(filters?: { patient_user_id?: string; clinician_user_id?: string }) {
  const { data, error } = await apiGet<unknown[]>("/api/appointments", filters as Record<string, string>);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createAppointment(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/appointments", payload);
  if (error) throw error;
  return data;
}

export async function updateAppointment(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/appointments/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deleteAppointment(id: string) {
  const { error } = await apiDelete(`/api/appointments/${id}`);
  if (error) throw error;
}

// --- SOAP notes ---
export async function listSoapNotes(filters?: { patient_user_id?: string; appointment_id?: string; clinician_user_id?: string }) {
  const { data, error } = await apiGet<unknown[]>("/api/soap-notes", filters as Record<string, string>);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createSoapNote(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/soap-notes", payload);
  if (error) throw error;
  return data;
}

export async function updateSoapNote(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/soap-notes/${id}`, payload);
  if (error) throw error;
}

export async function deleteSoapNote(id: string) {
  const { error } = await apiDelete(`/api/soap-notes/${id}`);
  if (error) throw error;
}

// --- Video rooms ---
export async function listVideoRooms(filters?: { user_id?: string }) {
  const { data, error } = await apiGet<unknown[]>("/api/video-rooms", filters as Record<string, string>);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function getVideoRoom(id: string) {
  const { data, error } = await apiGet<Record<string, unknown>>(`/api/video-rooms/${id}`);
  if (error) throw error;
  return data;
}

export async function listVideoRoomParticipants(roomId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/video-room-participants", { room_id: roomId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function getVideoCallNotes(roomId: string) {
  const { data, error } = await apiGet<unknown>("/api/video-call-notes", { room_id: roomId });
  if (error) throw error;
  if (Array.isArray(data)) return (data[0] ?? null) as Record<string, unknown> | null;
  return data as Record<string, unknown> | null;
}

export async function upsertVideoCallNotes(payload: Record<string, unknown>) {
  const { data, error } = await apiPut<Record<string, unknown>>("/api/video-call-notes", payload);
  if (error) throw error;
  return data;
}

// --- Caregiver invitations ---
export async function listCaregiverInvitations(filters?: {
  patient_user_id?: string;
  caregiver_user_id?: string;
  caregiver_email?: string;
  status?: string;
}) {
  const params = filters as Record<string, string> | undefined;
  const { data, error } = await apiGet<unknown[]>("/api/caregiver-invitations", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createCaregiverInvitation(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/caregiver-invitations", payload);
  if (error) throw error;
  return data;
}

export async function updateCaregiverInvitation(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/caregiver-invitations/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deleteCaregiverInvitation(id: string) {
  const { error } = await apiDelete(`/api/caregiver-invitations/${id}`);
  if (error) throw error;
}

// --- Caregiver messages ---
export async function listCaregiverMessages(filters: {
  patient_user_id?: string;
  caregiver_user_id?: string;
}) {
  const params: Record<string, string> = {};
  if (filters.patient_user_id) params.patient_user_id = filters.patient_user_id;
  if (filters.caregiver_user_id) params.caregiver_user_id = filters.caregiver_user_id;
  const { data, error } = await apiGet<unknown[]>("/api/caregiver-messages", Object.keys(params).length ? params : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createCaregiverMessage(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/caregiver-messages", payload);
  if (error) throw error;
  return data;
}

export async function updateCaregiverMessage(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/caregiver-messages/${id}`, payload);
  if (error) throw error;
}

// --- Red flag alerts ---
export async function listRedFlagAlerts(clinicianUserId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/red-flag-alerts", {
    clinician_user_id: clinicianUserId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updateRedFlagAlert(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/red-flag-alerts/${id}`, payload);
  if (error) throw error;
}

// --- Clinician messages ---
export async function listClinicianMessages(filters: {
  patient_user_id: string;
  clinician_user_id?: string;
}) {
  const params: Record<string, string> = { patient_user_id: filters.patient_user_id };
  if (filters.clinician_user_id) params.clinician_user_id = filters.clinician_user_id;
  const { data, error } = await apiGet<unknown[]>("/api/clinician-messages", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createClinicianMessage(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/clinician-messages", payload);
  if (error) throw error;
  return data;
}

export async function updateClinicianMessage(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/clinician-messages/${id}`, payload);
  if (error) throw error;
}

// --- Patient engagement scores ---
export async function listPatientEngagementScores(userId: string, params?: { from_date?: string }) {
  const q: Record<string, string> = { user_id: userId };
  if (params?.from_date) q.from_date = params.from_date;
  const { data, error } = await apiGet<unknown[]>("/api/patient-engagement-scores", q);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** Admin: list all engagement scores (optional risk_level, from_date, to_date filters). */
export async function listAllPatientEngagementScores(filters?: {
  risk_level?: string;
  from_date?: string;
  to_date?: string;
}) {
  const q: Record<string, string> = {};
  if (filters?.risk_level) q.risk_level = filters.risk_level;
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  const { data, error } = await apiGet<unknown[]>("/api/patient-engagement-scores", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** Admin: system analytics (log stats, symptom count, medications by form, role data). */
export async function getSystemAnalytics(): Promise<{
  logStats: { taken: number; missed: number; pending: number; skipped: number };
  adherenceRate: number;
  totalLogs: number;
  symptomCount: number;
  medicationsByForm: Array<{ name: string; value: number }>;
  roleData: Array<{ name: string; count: number }>;
}> {
  try {
    const { data, error } = await apiInvoke<{
      logStats?: { taken?: number; missed?: number; pending?: number; skipped?: number };
      adherenceRate?: number;
      totalLogs?: number;
      symptomCount?: number;
      medicationsByForm?: Array<{ name: string; value: number }>;
      roleData?: Array<{ name: string; count: number }>;
    }>("system-analytics", {});
    if (!error && data)
      return {
        logStats: data.logStats ?? { taken: 0, missed: 0, pending: 0, skipped: 0 },
        adherenceRate: data.adherenceRate ?? 0,
        totalLogs: data.totalLogs ?? 0,
        symptomCount: data.symptomCount ?? 0,
        medicationsByForm: data.medicationsByForm ?? [],
        roleData: data.roleData ?? [],
      };
  } catch {
    // fallback
  }
  const roles = await listUserRoles();
  const roleActivity = { patient: 0, clinician: 0, pharmacist: 0, admin: 0 };
  roles.forEach((r: Record<string, unknown>) => {
    const role = r.role as string;
    if (role in roleActivity) roleActivity[role as keyof typeof roleActivity]++;
  });
  return {
    logStats: { taken: 0, missed: 0, pending: 0, skipped: 0 },
    adherenceRate: 0,
    totalLogs: 0,
    symptomCount: 0,
    medicationsByForm: [],
    roleData: Object.entries(roleActivity).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
    })),
  };
}

// --- Refill requests ---
export async function listRefillRequests(filters?: { patient_user_id?: string; status?: string }) {
  const params = (filters || {}) as Record<string, string>;
  const { data, error } = await apiGet<unknown[]>("/api/refill-requests", Object.keys(params).length ? params : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createRefillRequest(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/refill-requests", payload);
  if (error) throw error;
  return data;
}

export async function updateRefillRequest(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/refill-requests/${id}`, payload);
  if (error) throw error;
}

// --- Controlled drugs ---
export async function listControlledDrugs() {
  const { data, error } = await apiGet<unknown[]>("/api/controlled-drugs");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createControlledDrug(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/controlled-drugs", payload);
  if (error) throw error;
  return data;
}

export async function listControlledDrugDispensing(limit?: number) {
  const { data, error } = await apiGet<unknown[]>("/api/controlled-drug-dispensing", limit ? { limit: String(limit) } : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createControlledDrugDispensing(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/controlled-drug-dispensing", payload);
  if (error) throw error;
  return data;
}

export async function listControlledDrugAdjustments(limit?: number) {
  const { data, error } = await apiGet<unknown[]>("/api/controlled-drug-adjustments", limit ? { limit: String(limit) } : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createControlledDrugAdjustment(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/controlled-drug-adjustments", payload);
  if (error) throw error;
  return data;
}

// --- Drug recalls ---
export async function listDrugRecalls() {
  const { data, error } = await apiGet<unknown[]>("/api/drug-recalls");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createDrugRecall(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/drug-recalls", payload);
  if (error) throw error;
  return data;
}

export async function updateDrugRecall(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/drug-recalls/${id}`, payload);
  if (error) throw error;
}

// --- Drug transfers ---
export async function listDrugTransfers(filters?: { source_pharmacy_id?: string; destination_pharmacy_id?: string; pharmacy_id?: string }) {
  const q: Record<string, string> = {};
  if (filters?.source_pharmacy_id) q.source_pharmacy_id = filters.source_pharmacy_id;
  if (filters?.destination_pharmacy_id) q.destination_pharmacy_id = filters.destination_pharmacy_id;
  if (filters?.pharmacy_id) q.pharmacy_id = filters.pharmacy_id;
  const { data, error } = await apiGet<unknown[]>("/api/drug-transfers", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  const list = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  return list;
}

export async function createDrugTransfer(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/drug-transfers", payload);
  if (error) throw error;
  return data;
}

export async function updateDrugTransfer(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/drug-transfers/${id}`, payload);
  if (error) throw error;
}

// --- Pharmacy medication availability (inventory at location) ---
export async function listMedicationAvailability(filters?: { pharmacy_id?: string }) {
  const { data, error } = await apiGet<unknown[]>("/api/medication-availability", filters as Record<string, string>);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createMedicationAvailability(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/medication-availability", payload);
  if (error) throw error;
  return data;
}

export async function updateMedicationAvailability(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/medication-availability/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function createPharmacyLocation(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/pharmacy-locations", payload);
  if (error) throw error;
  return data;
}

export async function getPharmacistDashboardStats(): Promise<{
  totalPrescriptions: number;
  lowStockAlerts: number;
  pendingRefills: number;
}> {
  const refills = await listRefillRequests();
  const pendingRefills = refills.filter((r: Record<string, unknown>) => r.status === "pending").length;
  return {
    totalPrescriptions: 0,
    lowStockAlerts: 0,
    pendingRefills,
  };
}

// --- Patient preferred pharmacies ---
export async function listPatientPreferredPharmacies(patientUserId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/patient-preferred-pharmacies", {
    patient_user_id: patientUserId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createPatientPreferredPharmacy(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/patient-preferred-pharmacies", payload);
  if (error) throw error;
  return data;
}

export async function updatePatientPreferredPharmacy(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/patient-preferred-pharmacies/${id}`, payload);
  if (error) throw error;
}

export async function deletePatientPreferredPharmacy(id: string) {
  const { error } = await apiDelete(`/api/patient-preferred-pharmacies/${id}`);
  if (error) throw error;
}

// --- Pharmacy locations ---
export async function listPharmacyLocations(params?: { is_active?: boolean; pharmacist_user_id?: string }) {
  const q: Record<string, string> = {};
  if (params?.is_active !== undefined) q.is_active = String(params.is_active);
  if (params?.pharmacist_user_id) q.pharmacist_user_id = params.pharmacist_user_id;
  const { data, error } = await apiGet<unknown[]>("/api/pharmacy-locations", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Medication availability alerts ---
export async function listMedicationAvailabilityAlerts(patientUserId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/medication-availability-alerts", {
    patient_user_id: patientUserId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createMedicationAvailabilityAlert(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/medication-availability-alerts", payload);
  if (error) throw error;
  return data;
}

export async function updateMedicationAvailabilityAlert(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/medication-availability-alerts/${id}`, payload);
  if (error) throw error;
}

export async function deleteMedicationAvailabilityAlert(id: string) {
  const { error } = await apiDelete(`/api/medication-availability-alerts/${id}`);
  if (error) throw error;
}

// --- Notifications / medication schedules ---
export async function createMedicationSchedule(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/medication-schedules", payload);
  if (error) throw error;
  return data;
}

export async function updateMedicationSchedule(id: string, payload: Record<string, unknown>) {
  const { error } = await apiPatch(`/api/medication-schedules/${id}`, payload);
  if (error) throw error;
}

export async function deleteMedicationSchedule(id: string) {
  const { error } = await apiDelete(`/api/medication-schedules/${id}`);
  if (error) throw error;
}

// --- Patient health (conditions, allergies, emergency contacts, vitals) ---
export async function listPatientHealthTable(table: string, userId: string) {
  const { data, error } = await apiGet<unknown[]>(`/api/${table}`, { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createPatientHealthRow(table: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>(`/api/${table}`, payload);
  if (error) throw error;
  return data;
}

export async function updatePatientHealthRow(table: string, id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/${table}/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deletePatientHealthRow(table: string, id: string) {
  const { error } = await apiDelete(`/api/${table}/${id}`);
  if (error) throw error;
}

// --- Push subscriptions ---
export async function listPushSubscriptions(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/push-subscriptions", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function upsertPushSubscription(payload: Record<string, unknown>) {
  const { data, error } = await apiPut<Record<string, unknown>>("/api/push-subscriptions", payload);
  if (error) throw error;
  return data;
}

export async function deletePushSubscription(userId: string, options?: { endpoint?: string; native_token?: string }) {
  const params: Record<string, string> = { user_id: userId };
  if (options?.endpoint) params.endpoint = options.endpoint;
  if (options?.native_token) params.native_token = options.native_token;
  const { error } = await apiDelete(
    `/api/push-subscriptions?${new URLSearchParams(params).toString()}`
  );
  if (error) throw error;
}

// --- RPC / function invocations (login attempts, security events, etc.) ---
export async function checkAccountLocked(email: string) {
  const { data, error } = await apiInvoke<{
    locked: boolean;
    locked_until?: string;
    failed_attempts?: number;
    minutes_remaining?: number;
  }>("check-account-locked", { email });
  if (error) {
    console.error("checkAccountLocked:", error);
    return { locked: false };
  }
  return data ?? { locked: false };
}

export async function recordLoginAttempt(
  email: string,
  success: boolean,
  options?: { ipAddress?: string; userAgent?: string }
) {
  const { data, error } = await apiInvoke<{ locked?: boolean; failed_attempts?: number; remaining_attempts?: number; message?: string }>(
    "record-login-attempt",
    {
      email,
      success,
      ip_address: options?.ipAddress ?? null,
      user_agent: options?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null),
    }
  );
  if (error) {
    console.error("recordLoginAttempt:", error);
    return { locked: false, message: "Error recording attempt" };
  }
  return data ?? { locked: false, message: "" };
}

export async function logSecurityEvent(payload: Record<string, unknown>) {
  const { error } = await apiInvoke("log-security-event", {
    ...payload,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
  if (error) throw error;
}

export async function logDataAccess(payload: Record<string, unknown>) {
  const { error } = await apiInvoke("log-data-access", payload);
  if (error) throw error;
}

export async function sendSecurityAlert(payload: {
  userId: string;
  eventType: string;
  severity: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await apiInvoke("send-security-alert", payload);
  if (error) console.error("send-security-alert:", error);
}

// --- Trusted devices ---
export async function isDeviceTrusted(userId: string, deviceId: string) {
  const { data, error } = await apiInvoke<{ trusted: boolean }>("is-device-trusted", {
    user_id: userId,
    device_id: deviceId,
  });
  if (error) throw error;
  return data?.trusted ?? false;
}

export async function trustDevice(
  userId: string,
  deviceId: string,
  options?: { label?: string; browser?: string; os?: string; days?: number }
) {
  const { data, error } = await apiInvoke<Record<string, unknown>>("trust-device", {
    user_id: userId,
    device_id: deviceId,
    device_name: options?.label,
    browser: options?.browser,
    os: options?.os,
    days: options?.days ?? 30,
  });
  if (error) throw error;
  return data;
}

export async function revokeTrustedDevice(userId: string, deviceId: string) {
  const { error } = await apiInvoke("revoke-trusted-device", { user_id: userId, device_id: deviceId });
  if (error) throw error;
}

export async function revokeAllTrustedDevices(userId: string) {
  const { data, error } = await apiInvoke<{ count?: number }>("revoke-all-trusted-devices", { user_id: userId });
  if (error) throw error;
  return data?.count ?? 0;
}

export async function listTrustedDevices(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/trusted-devices", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Security events (admin) ---
export async function listSecurityEvents(filters?: {
  user_id?: string;
  event_type?: string;
  severity?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}) {
  const q: Record<string, string> = {};
  if (filters?.user_id) q.user_id = filters.user_id;
  if (filters?.event_type) q.event_type = filters.event_type;
  if (filters?.severity) q.severity = filters.severity;
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  if (filters?.limit != null) q.limit = String(filters.limit);
  const { data, error } = await apiGet<unknown[]>("/api/security-events", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function listAccountLockouts(filters?: { from_date?: string; to_date?: string }) {
  const q: Record<string, string> = {};
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  const { data, error } = await apiGet<unknown[]>("/api/account-lockouts", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function listComplianceReports(limit?: number) {
  const { data, error } = await apiGet<unknown[]>("/api/compliance-reports", limit != null ? { limit: String(limit) } : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createComplianceReport(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/compliance-reports", payload);
  if (error) throw error;
  return data;
}

export async function listDataAccessLogs(filters?: { from_date?: string; to_date?: string; limit?: number }) {
  const q: Record<string, string> = {};
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  if (filters?.limit != null) q.limit = String(filters.limit);
  const { data, error } = await apiGet<unknown[]>("/api/data-access-log", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function listUserSessions(filters?: { is_active?: boolean }) {
  const q: Record<string, string> = {};
  if (filters?.is_active !== undefined) q.is_active = String(filters.is_active);
  const { data, error } = await apiGet<unknown[]>("/api/user-sessions", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Audit log (admin) ---
export async function listAuditLogs(filters?: {
  user_id?: string;
  action?: string;
  limit?: number;
  from_date?: string;
  to_date?: string;
}) {
  const q: Record<string, string> = {};
  if (filters?.user_id) q.user_id = filters.user_id;
  if (filters?.action) q.action = filters.action;
  if (filters?.limit != null) q.limit = String(filters.limit);
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  const { data, error } = await apiGet<unknown[]>("/api/audit-logs", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function getAdminDashboardStats(): Promise<{
  totalUsers: number;
  totalMedications: number;
  totalOrganizations: number;
  recentAuditLogs: number;
  roleCounts: { patient: number; clinician: number; pharmacist: number; admin: number };
}> {
  const emptyRoleCounts = { patient: 0, clinician: 0, pharmacist: 0, admin: 0 };
  try {
    const { data, error } = await apiInvoke<{
      totalUsers?: number;
      totalMedications?: number;
      totalOrganizations?: number;
      recentAuditLogs?: number;
      roleCounts?: { patient?: number; clinician?: number; pharmacist?: number; admin?: number };
    }>("admin-dashboard-stats", {});
    if (!error && data)
      return {
        totalUsers: data.totalUsers ?? 0,
        totalMedications: data.totalMedications ?? 0,
        totalOrganizations: data.totalOrganizations ?? 0,
        recentAuditLogs: data.recentAuditLogs ?? 0,
        roleCounts: data.roleCounts
          ? {
              patient: data.roleCounts.patient ?? 0,
              clinician: data.roleCounts.clinician ?? 0,
              pharmacist: data.roleCounts.pharmacist ?? 0,
              admin: data.roleCounts.admin ?? 0,
            }
          : emptyRoleCounts,
      };
  } catch {
    // fallback
  }
  const [profiles, auditLogs, roles] = await Promise.all([
    listProfiles(),
    listAuditLogs({ limit: 100 }),
    listUserRoles(),
  ]);
  const roleCounts = { ...emptyRoleCounts };
  roles.forEach((r: Record<string, unknown>) => {
    const role = r.role as string;
    if (role in roleCounts) roleCounts[role as keyof typeof roleCounts]++;
  });
  return {
    totalUsers: profiles.length,
    totalMedications: 0,
    totalOrganizations: 0,
    recentAuditLogs: auditLogs.length,
    roleCounts,
  };
}

// --- Security settings (session timeout, etc.) ---
export async function listSecuritySettings(keys?: string[]) {
  const params = keys?.length ? { keys: keys.join(",") } : undefined;
  const { data, error } = await apiGet<unknown[]>("/api/security-settings", params);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<{ setting_key: string; setting_value: unknown }>;
}

export async function updateSecuritySetting(
  settingKey: string,
  payload: { setting_value?: unknown; updated_by?: string }
) {
  const { error } = await apiPatch("/api/security-settings", { setting_key: settingKey, ...payload });
  if (error) throw error;
}

// --- Notification history ---
export async function listNotificationHistory(userId: string, params?: { channel?: string }) {
  const q: Record<string, string> = { user_id: userId };
  if (params?.channel) q.channel = params.channel;
  const { data, error } = await apiGet<unknown[]>("/api/notification-history", q);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

/** Admin: list all notification history with optional filters. */
export async function listAllNotificationHistory(filters?: {
  from_date?: string;
  to_date?: string;
  status?: string;
  limit?: number;
}) {
  const q: Record<string, string> = {};
  if (filters?.from_date) q.from_date = filters.from_date;
  if (filters?.to_date) q.to_date = filters.to_date;
  if (filters?.status) q.status = filters.status;
  if (filters?.limit != null) q.limit = String(filters.limit);
  const { data, error } = await apiGet<unknown[]>("/api/notification-history", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Patient notification preferences ---
export async function getPatientNotificationPreferences(userId: string) {
  const { data, error } = await apiGet<Record<string, unknown> | null>("/api/patient-notification-preferences", {
    user_id: userId,
  });
  if (error) throw error;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export async function createPatientNotificationPreferences(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/patient-notification-preferences", payload);
  if (error) throw error;
  return data;
}

export async function updatePatientNotificationPreferences(userId: string, updates: Record<string, unknown>) {
  const { error } = await apiPatch("/api/patient-notification-preferences", { user_id: userId, ...updates });
  if (error) throw error;
}

// --- Notification settings (admin) ---
export async function listNotificationSettings() {
  const { data, error } = await apiGet<unknown[]>("/api/notification-settings");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function updateNotificationSetting(settingKey: string, updates: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>("/api/notification-settings", {
    setting_key: settingKey,
    ...updates,
  });
  if (error) throw error;
  return data;
}

// --- MFA recovery codes ---
export async function listMfaRecoveryCodes(userId: string, params?: { unused_only?: boolean }) {
  const q: Record<string, string> = { user_id: userId };
  if (params?.unused_only === true) q.unused_only = "true";
  const { data, error } = await apiGet<unknown[]>("/api/mfa-recovery-codes", q);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createMfaRecoveryCodes(codes: Array<{ user_id: string; code_hash: string }>) {
  const { error } = await apiPost("/api/mfa-recovery-codes", { codes });
  if (error) throw error;
}

export async function deleteMfaRecoveryCodes(userId: string) {
  const { error } = await apiDelete(`/api/mfa-recovery-codes?user_id=${encodeURIComponent(userId)}`);
  if (error) throw error;
}

export async function verifyMfaRecoveryCode(userId: string, codeHash: string) {
  const { data, error } = await apiInvoke<{ valid: boolean }>("verify-mfa-recovery-code", {
    user_id: userId,
    code_hash: codeHash,
  });
  if (error) throw error;
  return data?.valid ?? false;
}

// --- Security notification preferences ---
export async function getSecurityNotificationPreferences(userId: string) {
  const { data, error } = await apiGet<Record<string, unknown> | null>("/api/security-notification-preferences", {
    user_id: userId,
  });
  if (error) throw error;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export async function upsertSecurityNotificationPreferences(userId: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPut<Record<string, unknown>>("/api/security-notification-preferences", {
    user_id: userId,
    ...payload,
  });
  if (error) throw error;
  return data;
}

// --- Lab results ---
export async function listLabResults(userId: string) {
  const { data, error } = await apiGet<unknown[]>("/api/lab-results", { user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Drug interactions ---
export async function listDrugInteractions() {
  const { data, error } = await apiGet<unknown[]>("/api/drug-interactions");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

// --- Email AB tests ---
export async function getActiveEmailAbTest(notificationType: string) {
  const { data, error } = await apiGet<Record<string, unknown> | null>("/api/email-ab-tests", {
    notification_type: notificationType,
    is_active: "true",
  });
  if (error) throw error;
  if (Array.isArray(data)) return (data[0] ?? null) as Record<string, unknown> | null;
  return data;
}

export async function getEmailAbAssignment(testId: string, userId: string) {
  const { data, error } = await apiGet<Record<string, unknown> | null>("/api/email-ab-assignments", {
    test_id: testId,
    user_id: userId,
  });
  if (error) throw error;
  if (Array.isArray(data)) return (data[0] ?? null) as Record<string, unknown> | null;
  return data;
}

export async function listEmailAbTests() {
  const { data, error } = await apiGet<unknown[]>("/api/email-ab-tests");
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function createEmailAbTest(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/email-ab-tests", payload);
  if (error) throw error;
  return data;
}

export async function updateEmailAbTest(id: string, payload: Record<string, unknown>) {
  const { data, error } = await apiPatch<Record<string, unknown>>(`/api/email-ab-tests/${id}`, payload);
  if (error) throw error;
  return data;
}

export async function deleteEmailAbTest(id: string) {
  const { error } = await apiDelete(`/api/email-ab-tests/${id}`);
  if (error) throw error;
}

export async function listEmailAbAssignments(filters?: { test_id?: string }) {
  const q: Record<string, string> = {};
  if (filters?.test_id) q.test_id = filters.test_id;
  const { data, error } = await apiGet<unknown[]>("/api/email-ab-assignments", Object.keys(q).length ? q : undefined);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

export async function deleteEmailAbAssignmentsByTestId(testId: string) {
  const { error } = await apiDelete(`/api/email-ab-assignments?test_id=${encodeURIComponent(testId)}`);
  if (error) throw error;
}

// --- Activity / AB test ---
export async function insertPatientActivityLog(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/patient-activity-log", payload);
  if (error) throw error;
  return data;
}

export async function insertEmailAbAssignment(payload: Record<string, unknown>) {
  const { data, error } = await apiPost<Record<string, unknown>>("/api/email-ab-assignments", payload);
  if (error) throw error;
  return data;
}

// --- Invoke arbitrary function (for send-email, send-notification, etc.) ---
export { apiInvoke };
