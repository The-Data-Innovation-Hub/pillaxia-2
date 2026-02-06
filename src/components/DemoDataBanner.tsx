import { useAuth } from "@/contexts/AuthContext";
import { isDemoMode, isDemoAccountEmail, isProduction } from "@/lib/environment";

/**
 * Demo Data Banner
 *
 * Shows a clear notice when the user is viewing demo/seed data so it is
 * always identified on screen (per project rules: mock/demo data must be
 * clearly identified).
 */
export function DemoDataBanner() {
  const { user } = useAuth();
  const show =
    user &&
    (isDemoMode() || isDemoAccountEmail(user.email ?? undefined));

  if (!show) return null;

  return (
    <div
      className={`fixed left-0 right-0 z-[9998] bg-amber-500 text-amber-950 text-center text-xs font-medium py-1.5 px-2 border-b border-amber-600/30 ${isProduction() ? "top-0" : "top-7"}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-700 animate-pulse" />
        Demo data – for demonstration only. Not real patient or clinical data.
      </span>
    </div>
  );
}
