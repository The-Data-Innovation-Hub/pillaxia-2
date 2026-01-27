import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-angela.png";
import { useLanguage } from "@/i18n/LanguageContext";

interface HeroSectionProps {
  onGetStarted?: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  return (
    <section className="relative bg-background overflow-hidden pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-pillaxia-cyan font-medium mb-4"
            >
              • Empowering Your Health Journey With Every Reminder •
            </motion.p>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground mb-6"
            >
              Angela – The Voice Behind Your Pill Reminders & Symptom Logs
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8 max-w-lg"
            >
              {t.landing.heroSubtitle}
            </motion.p>
            
            <motion.ul
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-3 mb-8"
            >
              <li className="flex items-start gap-3">
                <span className="text-pillaxia-cyan mt-1">•</span>
                <span className="text-foreground">Receive reminders to take your medication.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pillaxia-cyan mt-1">•</span>
                <span className="text-foreground">Help you log your symptoms quickly and easily</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pillaxia-cyan mt-1">•</span>
                <span className="text-foreground">Share your metrics with your medical team to ensure optimal health</span>
              </li>
            </motion.ul>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                size="lg"
                className="bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground text-xl py-6 px-8 rounded-xl shadow-lg"
                onClick={onGetStarted}
              >
                {t.nav.getStarted}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-pillaxia-cyan text-pillaxia-cyan hover:bg-pillaxia-cyan hover:text-primary-foreground text-xl py-6 px-8 rounded-xl shadow-lg"
                onClick={() => navigate("/auth")}
              >
                {t.nav.login}
              </Button>
            </motion.div>
          </div>
          
          <div className="lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-pillaxia-teal rounded-full opacity-30 blur-xl"></div>
              <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-primary rounded-full opacity-20 blur-xl"></div>
              <img
                src={heroImage}
                alt="Angela - AI Medication Assistant"
                className="relative z-10 rounded-2xl shadow-2xl w-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
