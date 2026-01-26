import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import BenefitsSection from "./BenefitsSection";
import MembershipSection from "./MembershipSection";
import NewsletterSection from "./NewsletterSection";
import Footer from "./Footer";
import AuthModals from "./AuthModals";

interface LandingProps {
  onLogin?: (role: "admin" | "pharmacist" | "patient") => void;
}

const Landing = ({ onLogin }: LandingProps) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  const handleLoginClick = () => {
    setAuthView("login");
    setShowAuthModal(true);
  };

  const handleSignupClick = () => {
    setAuthView("signup");
    setShowAuthModal(true);
  };

  // Listen for custom events from landing sections
  useEffect(() => {
    const handleShowLogin = () => {
      setAuthView("login");
      setShowAuthModal(true);
    };

    const handleShowSignup = () => {
      setAuthView("signup");
      setShowAuthModal(true);
    };

    document.addEventListener("pillaxia:showLogin", handleShowLogin);
    document.addEventListener("pillaxia:showSignup", handleShowSignup);

    return () => {
      document.removeEventListener("pillaxia:showLogin", handleShowLogin);
      document.removeEventListener("pillaxia:showSignup", handleShowSignup);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onSignupClick={handleSignupClick}
      />
      
      <main>
        <HeroSection
          onGetStarted={handleSignupClick}
        />
        <FeaturesSection />
        <BenefitsSection />
        <MembershipSection onJoinWaitlist={handleSignupClick} />
        <NewsletterSection />
      </main>
      
      <Footer />
      
      <AuthModals
        isOpen={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultView={authView}
        onLogin={onLogin}
      />
    </div>
  );
};

export default Landing;
