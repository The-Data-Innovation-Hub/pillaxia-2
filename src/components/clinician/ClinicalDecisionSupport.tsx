import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  RefreshCw,
  Stethoscope,
  FileText,
  Pill,
  Activity,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import angelaImage from "@/assets/hero-angela.png";
import ReactMarkdown from "react-markdown";

interface PatientData {
  id: string;
  name: string;
  symptoms?: Array<{
    name: string;
    severity: number;
    duration?: string;
    notes?: string;
  }>;
  vitals?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
  };
  labResults?: Array<{
    test_name: string;
    result_value: string;
    reference_range?: string;
    is_abnormal?: boolean;
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
    form: string;
  }>;
  healthProfile?: {
    conditions?: string[];
    allergies?: Array<{ allergen: string; severity?: string }>;
    age?: number;
    gender?: string;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ClinicalDecisionSupportProps {
  patient: PatientData;
  onClose?: () => void;
}

const CDS_URL = `${import.meta.env.VITE_AZURE_FUNCTIONS_URL || import.meta.env.VITE_API_URL}/api/clinical-decision-support`;

export function ClinicalDecisionSupport({ patient, onClose }: ClinicalDecisionSupportProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasInitialAnalysis, setHasInitialAnalysis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const runAnalysis = useCallback(async (customQuestion?: string) => {
    setLoading(true);

    const patientContext = {
      symptoms: patient.symptoms,
      vitals: patient.vitals,
      labResults: patient.labResults,
      medications: patient.medications,
      healthProfile: patient.healthProfile,
      clinicalQuestion: customQuestion,
    };

    if (customQuestion) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: customQuestion,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    let assistantContent = "";

    try {
      const conversationHistory = messages
        .map((m) => ({ role: m.role, content: m.content }));

      // Get the user's auth token for authenticated requests
      const token = await getToken();
      if (!token) {
        throw new Error("Please log in to use Clinical Decision Support");
      }

      const response = await fetch(CDS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          patientContext, 
          conversationHistory: customQuestion ? conversationHistory : undefined 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get CDS analysis");
      }

      if (!response.body) {
        throw new Error("No response stream available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const assistantMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            /* ignore */
          }
        }
      }

      setHasInitialAnalysis(true);
    } catch (error) {
      console.error("CDS error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get analysis");
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm sorry, I encountered an error while analyzing the patient data. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [patient, messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    await runAnalysis(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const patientSummary = {
    hasSymptoms: (patient.symptoms?.length ?? 0) > 0,
    hasVitals: patient.vitals && Object.keys(patient.vitals).length > 0,
    hasLabs: (patient.labResults?.length ?? 0) > 0,
    hasMeds: (patient.medications?.length ?? 0) > 0,
    hasProfile: patient.healthProfile && (
      (patient.healthProfile.conditions?.length ?? 0) > 0 ||
      (patient.healthProfile.allergies?.length ?? 0) > 0
    ),
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Clinical Decision Support
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                AI-powered analysis for {patient.name}
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {/* Patient Data Summary */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant={patientSummary.hasProfile ? "default" : "outline"} className="gap-1">
            <User className="h-3 w-3" />
            Profile
          </Badge>
          <Badge variant={patientSummary.hasSymptoms ? "default" : "outline"} className="gap-1">
            <Stethoscope className="h-3 w-3" />
            Symptoms ({patient.symptoms?.length ?? 0})
          </Badge>
          <Badge variant={patientSummary.hasVitals ? "default" : "outline"} className="gap-1">
            <Activity className="h-3 w-3" />
            Vitals
          </Badge>
          <Badge variant={patientSummary.hasLabs ? "default" : "outline"} className="gap-1">
            <FileText className="h-3 w-3" />
            Labs ({patient.labResults?.length ?? 0})
          </Badge>
          <Badge variant={patientSummary.hasMeds ? "default" : "outline"} className="gap-1">
            <Pill className="h-3 w-3" />
            Meds ({patient.medications?.length ?? 0})
          </Badge>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <Avatar className="h-16 w-16 mb-4 ring-2 ring-primary/20">
                <AvatarImage src={angelaImage} alt="Angela CDS" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Brain className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg mb-2">Angela Clinical Decision Support</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md">
                Analyze patient data for diagnostic insights, treatment recommendations, 
                and safety alerts. Click below to start the analysis.
              </p>
              <Button 
                onClick={() => runAnalysis()} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Run Initial Analysis
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={angelaImage} alt="Angela CDS" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <Brain className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={angelaImage} alt="Angela CDS" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      <Brain className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:100ms]" />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:200ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Disclaimer */}
        {hasInitialAnalysis && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                AI-generated suggestions for clinical consideration only. 
                Always apply professional judgment and verify recommendations.
              </p>
            </div>
          </div>
        )}

        {/* Input Area */}
        {hasInitialAnalysis && (
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question about this patient..."
                disabled={loading}
                className="flex-1 min-h-[44px] max-h-24 resize-none"
                rows={1}
              />
              <Button type="submit" disabled={loading || !input.trim()} size="icon" className="h-11 w-11">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
