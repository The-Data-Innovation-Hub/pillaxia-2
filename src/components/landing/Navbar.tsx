import { Button } from "@/components/ui/button";
import { Menu, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import pillaxiaLogo from "@/assets/pillaxia-logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const useAzureAuth = import.meta.env.VITE_USE_AZURE_AUTH === "true";

interface NavbarProps {
  onSignupClick?: () => void;
}

const Navbar = ({
  onSignupClick = () => {},
}: NavbarProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [azureRedirecting, setAzureRedirecting] = useState(false);

  const handleLoginClick = async () => {
    if (useAzureAuth) {
      setAzureRedirecting(true);
      try {
        await signIn("", "");
      } finally {
        setAzureRedirecting(false);
      }
    } else {
      navigate("/auth");
    }
  };

  const navLinks = [
    { href: "#", label: t.nav.home },
    { href: "#about", label: "About us" },
    { href: "#features", label: "Features" },
    { href: "#contact", label: "Contact Us" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={pillaxiaLogo} alt="Pillaxia" className="h-8" />
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <div className="flex items-center space-x-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-muted-foreground hover:text-pillaxia-cyan transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <Button
              variant="outline"
              className="border-pillaxia-cyan text-pillaxia-cyan hover:bg-pillaxia-cyan hover:text-primary-foreground shadow-pillaxia"
              onClick={handleLoginClick}
              disabled={azureRedirecting}
            >
              {useAzureAuth
                ? (azureRedirecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    "Sign in with Microsoft"
                  ))
                : t.nav.login}
            </Button>
            <Button
              className="bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground shadow-pillaxia"
              onClick={onSignupClick}
            >
              {t.landing.joinWaitlist}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          className="md:hidden p-2"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4 shadow-lg">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-muted-foreground hover:text-pillaxia-cyan py-2 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{t.settings.language}</span>
              <LanguageSwitcher showLabel={false} />
            </div>
            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <Button
                variant="outline"
                className="w-full border-pillaxia-cyan text-pillaxia-cyan hover:bg-pillaxia-cyan hover:text-primary-foreground"
                onClick={async () => {
                  if (useAzureAuth) {
                    setAzureRedirecting(true);
                    try {
                      await signIn("", "");
                    } finally {
                      setAzureRedirecting(false);
                      setMobileMenuOpen(false);
                    }
                  } else {
                    navigate("/auth");
                    setMobileMenuOpen(false);
                  }
                }}
                disabled={azureRedirecting}
              >
                {useAzureAuth
                  ? (azureRedirecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      "Sign in with Microsoft"
                    ))
                  : t.nav.login}
              </Button>
              <Button
                className="w-full bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground"
                onClick={() => {
                  onSignupClick();
                  setMobileMenuOpen(false);
                }}
              >
                {t.landing.joinWaitlist}
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
