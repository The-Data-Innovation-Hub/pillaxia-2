import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const NewsletterSection = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast.success(t.landing.subscribeSuccess, {
        description: t.landing.subscribeSuccessDesc,
      });
      setEmail("");
    }
  };

  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t.landing.newsletterTitle}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t.landing.newsletterSubtitle}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input
              type="email"
              placeholder={t.landing.newsletterPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button
              type="submit"
              className="bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground px-8"
            >
              {t.landing.subscribe}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
