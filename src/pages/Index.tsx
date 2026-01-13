import Landing from "@/components/landing";
import { toast } from "sonner";

const Index = () => {
  const handleLogin = (role: "admin" | "pharmacist" | "patient") => {
    toast.success(`Logged in as ${role}!`, {
      description: "Dashboard functionality coming soon.",
    });
  };

  return <Landing onLogin={handleLogin} />;
};

export default Index;
