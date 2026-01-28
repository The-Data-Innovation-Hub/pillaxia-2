import { useState, useEffect } from "react";
import { CreditCard, Loader2, ExternalLink, Check, AlertTriangle, Receipt, Clock, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface SubscriptionData {
  subscribed: boolean;
  tier: string | null;
  status: string | null;
  seats_purchased: number;
  seats_used: number;
  subscription_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

interface Invoice {
  id: string;
  stripe_invoice_id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

const PRICING_TIERS = {
  starter: {
    name: "Starter Clinic",
    price: 99,
    seats: 10,
    features: ["Up to 10 users", "Basic features", "Email support"],
  },
  professional: {
    name: "Professional Practice",
    price: 299,
    seats: 50,
    features: ["Up to 50 users", "Advanced analytics", "Priority support", "API access"],
  },
  enterprise: {
    name: "Large Hospital",
    price: 10000,
    seats: 500,
    features: ["Up to 500 users", "Dedicated support", "Custom integrations", "SLA guarantee"],
  },
};

export function OrganizationBillingTab() {
  const { organization, isOrgAdmin } = useOrganization();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      fetchSubscriptionData();
      fetchInvoices();
    }
  }, [organization?.id]);

  const fetchSubscriptionData = async () => {
    if (!organization?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("check-org-subscription", {
        body: { organizationId: organization.id },
      });

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoices = async () => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from("organization_invoices")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setInvoices(data as Invoice[]);
    }
  };

  const handleSubscribe = async (tier: string) => {
    if (!organization?.id || !isOrgAdmin) return;

    setIsCheckoutLoading(tier);
    try {
      const tierConfig = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];
      const { data, error } = await supabase.functions.invoke("create-org-checkout", {
        body: { 
          organizationId: organization.id, 
          tier,
          seats: tierConfig.seats,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout");
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!organization?.id) return;

    setIsPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("org-customer-portal", {
        body: { organizationId: organization.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/10 text-blue-500">Trial</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Past Due</Badge>;
      case "canceled":
        return <Badge className="bg-red-500/10 text-red-500">Canceled</Badge>;
      default:
        return <Badge variant="secondary">No Subscription</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>
                Manage your organization's billing and subscription
              </CardDescription>
            </div>
            {getStatusBadge(subscription?.status || null)}
          </div>
        </CardHeader>
        <CardContent>
          {subscription?.subscribed ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-xl font-semibold capitalize">
                    {subscription.tier || "Unknown"}
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm text-muted-foreground">Billing Period Ends</p>
                  <p className="text-xl font-semibold">
                    {subscription.subscription_end 
                      ? format(new Date(subscription.subscription_end), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Seats Usage
                  </p>
                  <p className="text-xl font-semibold">
                    {subscription.seats_used} / {subscription.seats_purchased}
                  </p>
                  <Progress 
                    value={(subscription.seats_used / subscription.seats_purchased) * 100} 
                    className="h-2 mt-2"
                  />
                </div>
              </div>

              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Your subscription will be canceled at the end of the current billing period.
                  </span>
                </div>
              )}

              {isOrgAdmin && (
                <Button onClick={handleManageBilling} disabled={isPortalLoading}>
                  {isPortalLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-4">
                Choose a plan below to unlock all features for your organization.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      {!subscription?.subscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Plan</CardTitle>
            <CardDescription>
              Select the plan that best fits your organization's needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(PRICING_TIERS).map(([key, tier]) => (
                <div
                  key={key}
                  className={`relative p-6 rounded-xl border-2 transition-all ${
                    key === "professional" 
                      ? "border-primary shadow-lg" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {key === "professional" && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Most Popular
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold">{tier.name}</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={key === "professional" ? "default" : "outline"}
                    onClick={() => handleSubscribe(key)}
                    disabled={isCheckoutLoading !== null || !isOrgAdmin}
                  >
                    {isCheckoutLoading === key ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Subscribe
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      invoice.status === "paid" 
                        ? "bg-green-500/10" 
                        : "bg-yellow-500/10"
                    }`}>
                      {invoice.status === "paid" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {formatCurrency(invoice.amount_paid || invoice.amount_due, invoice.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.period_start && invoice.period_end
                          ? `${format(new Date(invoice.period_start), "MMM d")} - ${format(new Date(invoice.period_end), "MMM d, yyyy")}`
                          : format(new Date(invoice.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                      {invoice.status}
                    </Badge>
                    {invoice.invoice_pdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.invoice_pdf!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
