import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, FileText, User, Calendar, Trash2, Edit, Loader2 } from "lucide-react";

interface SOAPNote {
  id: string;
  clinician_user_id: string;
  patient_user_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  visit_date: string;
  created_at: string;
  updated_at: string;
}

interface PatientInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

export function SOAPNotesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<SOAPNote | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [filterPatient, setFilterPatient] = useState<string>("all");
  const [formData, setFormData] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    visit_date: format(new Date(), "yyyy-MM-dd"),
  });

  // Fetch assigned patients
  const { data: patients } = useQuery({
    queryKey: ["clinician-patients", user?.id],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("clinician_patient_assignments")
        .select("patient_user_id")
        .eq("clinician_user_id", user!.id);

      if (!assignments?.length) return [];

      const patientIds = assignments.map((a) => a.patient_user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      return profiles as PatientInfo[];
    },
    enabled: !!user,
  });

  // Fetch SOAP notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ["soap-notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("soap_notes")
        .select("*")
        .eq("clinician_user_id", user!.id)
        .order("visit_date", { ascending: false });

      if (error) throw error;
      return data as SOAPNote[];
    },
    enabled: !!user,
  });

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      patient_user_id: string;
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
      visit_date: string;
      id?: string;
    }) => {
      if (data.id) {
        const { error } = await supabase
          .from("soap_notes")
          .update({
            subjective: data.subjective || null,
            objective: data.objective || null,
            assessment: data.assessment || null,
            plan: data.plan || null,
            visit_date: data.visit_date,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("soap_notes")
          .insert({
            clinician_user_id: user!.id,
            patient_user_id: data.patient_user_id,
            subjective: data.subjective || null,
            objective: data.objective || null,
            assessment: data.assessment || null,
            plan: data.plan || null,
            visit_date: data.visit_date,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soap-notes"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingNote ? "Note updated" : "Note created");
    },
    onError: (error) => {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("soap_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soap-notes"] });
      toast.success("Note deleted");
    },
    onError: () => {
      toast.error("Failed to delete note");
    },
  });

  const resetForm = () => {
    setFormData({
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      visit_date: format(new Date(), "yyyy-MM-dd"),
    });
    setSelectedPatient("");
    setEditingNote(null);
  };

  const handleEdit = (note: SOAPNote) => {
    setEditingNote(note);
    setSelectedPatient(note.patient_user_id);
    setFormData({
      subjective: note.subjective || "",
      objective: note.objective || "",
      assessment: note.assessment || "",
      plan: note.plan || "",
      visit_date: note.visit_date,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient && !editingNote) {
      toast.error("Please select a patient");
      return;
    }

    saveMutation.mutate({
      patient_user_id: editingNote?.patient_user_id || selectedPatient,
      ...formData,
      id: editingNote?.id,
    });
  };

  const getPatientName = (patientId: string) => {
    const patient = patients?.find((p) => p.user_id === patientId);
    return patient
      ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown"
      : "Unknown";
  };

  const filteredNotes = notes?.filter(
    (note) => filterPatient === "all" || note.patient_user_id === filterPatient
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SOAP Notes</h1>
          <p className="text-muted-foreground">Clinical documentation for patient visits</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle>{editingNote ? "Edit" : "Create"} SOAP Note</DialogTitle>
              <DialogDescription>
                Document patient visit using the SOAP format
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingNote && (
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {patients?.map((patient) => (
                        <SelectItem key={patient.user_id} value={patient.user_id}>
                          {patient.first_name} {patient.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="visit_date">Visit Date</Label>
                <Input
                  id="visit_date"
                  type="date"
                  value={formData.visit_date}
                  onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjective" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">S</Badge>
                  Subjective
                </Label>
                <Textarea
                  id="subjective"
                  placeholder="Patient's symptoms, feelings, and medical history as reported..."
                  value={formData.subjective}
                  onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">O</Badge>
                  Objective
                </Label>
                <Textarea
                  id="objective"
                  placeholder="Clinical findings, vital signs, test results..."
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assessment" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">A</Badge>
                  Assessment
                </Label>
                <Textarea
                  id="assessment"
                  placeholder="Diagnosis, clinical reasoning, differential diagnoses..."
                  value={formData.assessment}
                  onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan" className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">P</Badge>
                  Plan
                </Label>
                <Textarea
                  id="plan"
                  placeholder="Treatment plan, medications, follow-up, patient education..."
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingNote ? "Update" : "Create"} Note
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Notes</p>
                <p className="text-2xl font-bold">{notes?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patients Documented</p>
                <p className="text-2xl font-bold">
                  {new Set(notes?.map((n) => n.patient_user_id)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  {notes?.filter((n) => {
                    const noteDate = new Date(n.visit_date);
                    const now = new Date();
                    return noteDate.getMonth() === now.getMonth() && 
                           noteDate.getFullYear() === now.getFullYear();
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clinical Notes</CardTitle>
          <Select value={filterPatient} onValueChange={setFilterPatient}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by patient" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">All Patients</SelectItem>
              {patients?.map((patient) => (
                <SelectItem key={patient.user_id} value={patient.user_id}>
                  {patient.first_name} {patient.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !filteredNotes?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No SOAP notes found. Create your first note to get started.
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredNotes.map((note) => (
                <AccordionItem
                  key={note.id}
                  value={note.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{getPatientName(note.patient_user_id)}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(note.visit_date), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {note.subjective && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">S</Badge>
                            <span className="text-sm font-medium">Subjective</span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{note.subjective}</p>
                        </div>
                      )}
                      {note.objective && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">O</Badge>
                            <span className="text-sm font-medium">Objective</span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{note.objective}</p>
                        </div>
                      )}
                      {note.assessment && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">A</Badge>
                            <span className="text-sm font-medium">Assessment</span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{note.assessment}</p>
                        </div>
                      )}
                      {note.plan && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">P</Badge>
                            <span className="text-sm font-medium">Plan</span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{note.plan}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(note)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this note?")) {
                              deleteMutation.mutate(note.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
