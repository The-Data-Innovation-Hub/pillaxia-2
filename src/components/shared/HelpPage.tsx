import { 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageCircle, 
  ExternalLink,
  BookOpen,
  Shield,
  Pill,
  Users,
  Bell,
  Calendar,
  Heart
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";

const generalFAQs = [
  {
    question: "How do I reset my password?",
    answer: "Click on the 'Forgot Password' link on the login page. Enter your email address and we'll send you a secure link to reset your password. The link expires after 24 hours.",
    icon: Shield,
  },
  {
    question: "How do I update my profile information?",
    answer: "Navigate to Settings from the sidebar menu. Here you can update your personal details, contact information, language preferences, and notification settings.",
    icon: Users,
  },
  {
    question: "Is my data secure?",
    answer: "Yes, we use industry-standard encryption and security practices. All data is encrypted in transit and at rest. We comply with healthcare data protection regulations and never share your information with third parties without consent.",
    icon: Shield,
  },
  {
    question: "How do I enable dark mode?",
    answer: "Click the theme toggle in the sidebar footer. You can choose between Light, Dark, or System (which follows your device settings).",
    icon: HelpCircle,
  },
];

const patientFAQs = [
  {
    question: "How do I add a new medication?",
    answer: "Go to the Medications page and click 'Add Medication'. Fill in the medication name, dosage, frequency, and any special instructions. You can also take a photo of your prescription label to auto-fill the information.",
    icon: Pill,
  },
  {
    question: "How do medication reminders work?",
    answer: "Once you set up your medication schedule, Pillaxia will send you reminders via push notifications, SMS, email, or WhatsApp based on your notification preferences. You can customize these in Settings > Notifications.",
    icon: Bell,
  },
  {
    question: "How do I add a caregiver?",
    answer: "Go to Caregivers page and enter your caregiver's email address. They'll receive an invitation to connect with you. Once accepted, they can view your medication schedule and receive alerts about missed doses.",
    icon: Heart,
  },
  {
    question: "What is Angela and how can she help me?",
    answer: "Angela is your AI health companion. She can answer questions about your medications, remind you about doses, provide health tips, and help you track symptoms. Just chat with her anytime from the Angela tab.",
    icon: MessageCircle,
  },
  {
    question: "How do I log a missed dose?",
    answer: "In your Schedule page, find the missed medication and tap on it. You can mark it as 'Taken Late', 'Skipped', or add notes about why you missed it. This helps your healthcare team understand your adherence patterns.",
    icon: Calendar,
  },
];

const clinicianFAQs = [
  {
    question: "How do I add a patient to my roster?",
    answer: "Go to Patient Roster and click 'Add Patient'. Search for the patient by email or name. Once connected, you'll be able to view their medication list, adherence data, and symptom reports.",
    icon: Users,
  },
  {
    question: "What are red flag alerts?",
    answer: "Red flag alerts notify you when a patient reports severe symptoms (severity 8+) or concerning patterns. These alerts appear on your dashboard and require acknowledgment. You can also set up SMS/email notifications for urgent alerts.",
    icon: Bell,
  },
  {
    question: "How do I create SOAP notes?",
    answer: "Navigate to SOAP Notes from the sidebar. Select a patient and click 'New Note'. You can document Subjective, Objective, Assessment, and Plan sections. Notes are auto-saved and can be exported as PDF.",
    icon: BookOpen,
  },
  {
    question: "How do I schedule a follow-up appointment?",
    answer: "Go to Appointments page and click 'Schedule Appointment'. Select the patient, date, time, and add a description. The patient will receive an automated reminder 24 hours before the appointment.",
    icon: Calendar,
  },
];

const pharmacistFAQs = [
  {
    question: "How do I process a refill request?",
    answer: "Go to Refill Requests to view pending requests. Review the prescription details, check insurance eligibility, and either approve or flag for pharmacist review. Approved refills automatically notify the patient.",
    icon: Pill,
  },
  {
    question: "How do I update inventory levels?",
    answer: "Navigate to Inventory and select the medication. Click 'Update Stock' to adjust quantities. You can also set low-stock thresholds to receive alerts when inventory needs replenishing.",
    icon: Pill,
  },
  {
    question: "How do I verify prescriptions?",
    answer: "In the Prescriptions section, review the e-prescription details including prescriber information, DEA number, and patient information. Use the verification checklist before dispensing.",
    icon: Shield,
  },
];

const adminFAQs = [
  {
    question: "How do I create a new user account?",
    answer: "Go to User Management and click 'Add User'. Enter the user's email, name, and assign appropriate roles. They'll receive an invitation email to set up their password.",
    icon: Users,
  },
  {
    question: "How do I view audit logs?",
    answer: "Navigate to Audit Logs from the sidebar. You can filter by user, action type, date range, or specific tables. All authentication events, data changes, and administrative actions are logged.",
    icon: BookOpen,
  },
  {
    question: "How do I configure notification settings?",
    answer: "Go to Settings > Notifications to enable/disable system-wide notification features. You can also configure A/B testing for notification strategies to optimize patient engagement.",
    icon: Bell,
  },
];

export function HelpPage() {
  const { isPatient, isClinician, isPharmacist, isAdmin } = useAuth();

  // Determine which role-specific FAQs to show
  const getRoleFAQs = () => {
    if (isAdmin) return { title: "Admin FAQs", faqs: adminFAQs };
    if (isPharmacist) return { title: "Pharmacist FAQs", faqs: pharmacistFAQs };
    if (isClinician) return { title: "Clinician FAQs", faqs: clinicianFAQs };
    return { title: "Patient FAQs", faqs: patientFAQs };
  };

  const roleFAQs = getRoleFAQs();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          Help & Support
        </h1>
        <p className="text-muted-foreground mt-1">
          Find answers to common questions or get in touch with our support team
        </p>
      </div>

      {/* Contact Support Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl">Need Help?</CardTitle>
          <CardDescription>
            Our support team is available Monday to Friday, 8am to 6pm WAT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="mailto:support@pillaxia.com">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Email Support</span>
                <span className="text-xs text-muted-foreground">support@pillaxia.com</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="tel:+2348001234567">
                <Phone className="h-5 w-5 text-primary" />
                <span className="font-medium">Phone Support</span>
                <span className="text-xs text-muted-foreground">+234 800 123 4567</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <a href="https://wa.me/2348001234567" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">WhatsApp</span>
                <span className="text-xs text-muted-foreground">+234 800 123 4567</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* General FAQs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              General FAQs
            </CardTitle>
            <CardDescription>Common questions about using Pillaxia</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {generalFAQs.map((faq, index) => (
                <AccordionItem key={index} value={`general-${index}`}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2">
                      <faq.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Role-Specific FAQs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {roleFAQs.title}
            </CardTitle>
            <CardDescription>Questions specific to your role</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {roleFAQs.faqs.map((faq, index) => (
                <AccordionItem key={index} value={`role-${index}`}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2">
                      <faq.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>Helpful links and documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="ghost" className="h-auto py-3 justify-start gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">User Guide</p>
                <p className="text-xs text-muted-foreground">Complete documentation</p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="h-auto py-3 justify-start gap-3">
              <MessageCircle className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">Video Tutorials</p>
                <p className="text-xs text-muted-foreground">Step-by-step guides</p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="h-auto py-3 justify-start gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">Data protection info</p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="h-auto py-3 justify-start gap-3">
              <HelpCircle className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">Terms of Service</p>
                <p className="text-xs text-muted-foreground">Legal information</p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}