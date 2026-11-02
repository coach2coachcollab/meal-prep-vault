import { useState, useEffect, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "coach")[];
}

// Module-level so the default keeps one identity: an inline array is new on every render,
// which re-triggers the role-check effect forever and leaves the page on the spinner.
const DEFAULT_ALLOWED_ROLES: ("admin" | "coach")[] = ["admin", "coach"];

export function AdminRoute({ children, allowedRoles = DEFAULT_ALLOWED_ROLES }: AdminRouteProps) {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Keyed on the id, not the user object: Supabase re-emits the session with a new object
  // whenever the window regains focus (e.g. closing a file picker). Re-checking then would
  // swap the page for the spinner, unmounting it and losing whatever the admin was doing.
  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setChecking(false);
      return;
    }

    const checkRoles = async () => {
      setChecking(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const userRoles = (data || []).map((r) => r.role);
      setAuthorized(userRoles.some((r) => allowedRoles.includes(r as any)));
      setChecking(false);
    };

    checkRoles();
  }, [userId, loading, allowedRoles]);

  if (loading || (user && checking)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  if (!user) return <Navigate to="/auth" replace />;
  if (!authorized) return <Navigate to="/" replace />;
  return <>{children}</>;
}
