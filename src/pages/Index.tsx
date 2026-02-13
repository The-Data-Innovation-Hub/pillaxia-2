import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Landing from "@/components/landing";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If Entra redirected to / with code & state (e.g. redirect URI was origin-only), send to callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state) {
      navigate(`/auth/callback?${searchParams.toString()}`, { replace: true });
    }
  }, [navigate, searchParams]);

  const handleLogin = (role: "admin" | "pharmacist" | "patient") => {
    toast.success(`Logged in as ${role}!`, {
      description: "Dashboard functionality coming soon.",
    });
  };

  return <Landing onLogin={handleLogin} />;
};

export default Index;
