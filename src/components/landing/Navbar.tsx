import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import pillaxiaLogo from "@/assets/pillaxia-logo.png";

interface NavbarProps {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
}

const Navbar = ({
  onLoginClick = () => {},
  onSignupClick = () => {},
}: NavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#", label: "Home" },
    { href: "#about", label: "About us" },
    { href: "#features", label: "Features" },
    { href: "#contact", label: "Contact Us" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
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
            <Button
              variant="outline"
              className="border-pillaxia-cyan text-pillaxia-cyan hover:bg-pillaxia-cyan hover:text-primary-foreground shadow-pillaxia"
              onClick={onLoginClick}
            >
              Login
            </Button>
            <Button
              className="bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground shadow-pillaxia"
              onClick={onSignupClick}
            >
              Join our Waiting List
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
            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <Button
                variant="outline"
                className="w-full border-pillaxia-cyan text-pillaxia-cyan hover:bg-pillaxia-cyan hover:text-primary-foreground"
                onClick={() => {
                  onLoginClick();
                  setMobileMenuOpen(false);
                }}
              >
                Login
              </Button>
              <Button
                className="w-full bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground"
                onClick={() => {
                  onSignupClick();
                  setMobileMenuOpen(false);
                }}
              >
                Join our Waiting List
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
