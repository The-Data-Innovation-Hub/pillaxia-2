import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Edit, Heart, AlertTriangle, Phone, X } from "lucide-react";

interface ChronicCondition {
  id: string;
  condition_name: string;
  diagnosed_date: string | null;
  notes: string | null;
  is_active: boolean;
}

interface Allergy {
  id: string;
  allergen: string;
  reaction_type: string | null;
  reaction_description: string | null;
  is_drug_allergy: boolean;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  is_primary: boolean;
}

export function HealthProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conditions, setConditions] = useState<ChronicCondition[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
  const [allergyDialogOpen, setAllergyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const [editingCondition, setEditingCondition] = useState<ChronicCondition | null>(null);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  const [deleteId, setDeleteId] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [conditionsRes, allergiesRes, contactsRes] = await Promise.all([
        supabase.from("patient_chronic_conditions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("patient_allergies").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("patient_emergency_contacts").select("*").eq("user_id", user.id).order("is_primary", { ascending: false }),
      ]);

      if (conditionsRes.data) setConditions(conditionsRes.data);
      if (allergiesRes.data) setAllergies(allergiesRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
    } catch (error) {
      console.error("Error fetching health profile:", error);
      toast.error("Failed to load health profile");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const table = deleteId.type === "condition" 
      ? "patient_chronic_conditions" 
      : deleteId.type === "allergy" 
        ? "patient_allergies" 
        : "patient_emergency_contacts";

    try {
      const { error } = await supabase.from(table).delete().eq("id", deleteId.id);
      if (error) throw error;
      toast.success("Deleted successfully");
      fetchAll();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Health Profile</h1>
        <p className="text-muted-foreground">
          Manage your health conditions, allergies, and emergency contacts
        </p>
      </div>

      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conditions" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="allergies" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Allergies
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Emergency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Chronic Conditions</h3>
            <Button onClick={() => { setEditingCondition(null); setConditionDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>

          {conditions.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="text-center py-8">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No conditions recorded</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {conditions.map((condition) => (
                <Card key={condition.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{condition.condition_name}</span>
                        {!condition.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      {condition.diagnosed_date && (
                        <p className="text-sm text-muted-foreground">
                          Diagnosed: {new Date(condition.diagnosed_date).toLocaleDateString()}
                        </p>
                      )}
                      {condition.notes && <p className="text-sm text-muted-foreground mt-1">{condition.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingCondition(condition); setConditionDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId({ type: "condition", id: condition.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="allergies" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Allergies</h3>
            <Button onClick={() => { setEditingAllergy(null); setAllergyDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Allergy
            </Button>
          </div>

          {allergies.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No allergies recorded</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {allergies.map((allergy) => (
                <Card key={allergy.id} className={allergy.reaction_type === "severe" || allergy.reaction_type === "anaphylaxis" ? "border-destructive" : ""}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{allergy.allergen}</span>
                        {allergy.is_drug_allergy && <Badge variant="destructive">Drug Allergy</Badge>}
                        {allergy.reaction_type && (
                          <Badge variant={allergy.reaction_type === "severe" || allergy.reaction_type === "anaphylaxis" ? "destructive" : "secondary"}>
                            {allergy.reaction_type}
                          </Badge>
                        )}
                      </div>
                      {allergy.reaction_description && (
                        <p className="text-sm text-muted-foreground mt-1">{allergy.reaction_description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingAllergy(allergy); setAllergyDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId({ type: "allergy", id: allergy.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Emergency Contacts</h3>
            <Button onClick={() => { setEditingContact(null); setContactDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {contacts.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="text-center py-8">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No emergency contacts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <Card key={contact.id} className={contact.is_primary ? "border-primary" : ""}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contact.name}</span>
                          {contact.is_primary && <Badge>Primary</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                        <p className="text-sm mt-2">{contact.phone}</p>
                        {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingContact(contact); setContactDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId({ type: "contact", id: contact.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConditionDialog
        open={conditionDialogOpen}
        onOpenChange={setConditionDialogOpen}
        editing={editingCondition}
        onSuccess={fetchAll}
      />

      <AllergyDialog
        open={allergyDialogOpen}
        onOpenChange={setAllergyDialogOpen}
        editing={editingAllergy}
        onSuccess={fetchAll}
      />

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        editing={editingContact}
        onSuccess={fetchAll}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sub-dialogs for adding/editing
function ConditionDialog({ open, onOpenChange, editing, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ChronicCondition | null;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [diagnosedDate, setDiagnosedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (editing) {
      setName(editing.condition_name);
      setDiagnosedDate(editing.diagnosed_date || "");
      setNotes(editing.notes || "");
      setIsActive(editing.is_active);
    } else {
      setName("");
      setDiagnosedDate("");
      setNotes("");
      setIsActive(true);
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const data = {
        user_id: user.id,
        condition_name: name,
        diagnosed_date: diagnosedDate || null,
        notes: notes || null,
        is_active: isActive,
      };

      if (editing) {
        const { error } = await supabase.from("patient_chronic_conditions").update(data).eq("id", editing.id);
        if (error) throw error;
        toast.success("Condition updated");
      } else {
        const { error } = await supabase.from("patient_chronic_conditions").insert(data);
        if (error) throw error;
        toast.success("Condition added");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving condition:", error);
      toast.error("Failed to save condition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Condition" : "Add Condition"}</DialogTitle>
          <DialogDescription>Record a chronic health condition</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="condition-name">Condition Name *</Label>
            <Input id="condition-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Type 2 Diabetes" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diagnosed-date">Diagnosed Date</Label>
            <Input id="diagnosed-date" type="date" value={diagnosedDate} onChange={(e) => setDiagnosedDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition-notes">Notes</Label>
            <Textarea id="condition-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional details..." rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is-active">Currently Active</Label>
            <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllergyDialog({ open, onOpenChange, editing, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Allergy | null;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allergen, setAllergen] = useState("");
  const [reactionType, setReactionType] = useState("");
  const [reactionDescription, setReactionDescription] = useState("");
  const [isDrugAllergy, setIsDrugAllergy] = useState(false);

  useEffect(() => {
    if (editing) {
      setAllergen(editing.allergen);
      setReactionType(editing.reaction_type || "");
      setReactionDescription(editing.reaction_description || "");
      setIsDrugAllergy(editing.is_drug_allergy);
    } else {
      setAllergen("");
      setReactionType("");
      setReactionDescription("");
      setIsDrugAllergy(false);
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const data = {
        user_id: user.id,
        allergen,
        reaction_type: reactionType || null,
        reaction_description: reactionDescription || null,
        is_drug_allergy: isDrugAllergy,
      };

      if (editing) {
        const { error } = await supabase.from("patient_allergies").update(data).eq("id", editing.id);
        if (error) throw error;
        toast.success("Allergy updated");
      } else {
        const { error } = await supabase.from("patient_allergies").insert(data);
        if (error) throw error;
        toast.success("Allergy added");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving allergy:", error);
      toast.error("Failed to save allergy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Allergy" : "Add Allergy"}</DialogTitle>
          <DialogDescription>Record an allergy or sensitivity</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allergen">Allergen *</Label>
            <Input id="allergen" value={allergen} onChange={(e) => setAllergen(e.target.value)} placeholder="e.g., Penicillin, Peanuts" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reaction-type">Reaction Severity</Label>
            <Select value={reactionType} onValueChange={setReactionType}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
                <SelectItem value="anaphylaxis">Anaphylaxis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reaction-description">Reaction Description</Label>
            <Textarea id="reaction-description" value={reactionDescription} onChange={(e) => setReactionDescription(e.target.value)} placeholder="Describe the reaction..." rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is-drug-allergy">Drug Allergy</Label>
            <Switch id="is-drug-allergy" checked={isDrugAllergy} onCheckedChange={setIsDrugAllergy} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !allergen}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({ open, onOpenChange, editing, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EmergencyContact | null;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setRelationship(editing.relationship);
      setPhone(editing.phone);
      setEmail(editing.email || "");
      setIsPrimary(editing.is_primary);
    } else {
      setName("");
      setRelationship("");
      setPhone("");
      setEmail("");
      setIsPrimary(false);
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const data = {
        user_id: user.id,
        name,
        relationship,
        phone,
        email: email || null,
        is_primary: isPrimary,
      };

      if (editing) {
        const { error } = await supabase.from("patient_emergency_contacts").update(data).eq("id", editing.id);
        if (error) throw error;
        toast.success("Contact updated");
      } else {
        const { error } = await supabase.from("patient_emergency_contacts").insert(data);
        if (error) throw error;
        toast.success("Contact added");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Contact" : "Add Emergency Contact"}</DialogTitle>
          <DialogDescription>Add someone to contact in case of emergency</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship *</Label>
            <Input id="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g., Spouse, Parent, Child" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone *</Label>
            <Input id="contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 xxx xxx xxxx" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is-primary">Primary Contact</Label>
            <Switch id="is-primary" checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name || !relationship || !phone}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
