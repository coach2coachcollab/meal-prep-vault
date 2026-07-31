import { useState, useEffect, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "coach")[];
}

export function AdminRoute({ children, allowedRoles = ["admin", "coach"] }: AdminRouteProps) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const checkRoles = async () => {
      setChecking(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = (data || []).map((r) => r.role);
      setAuthorized(userRoles.some((r) => allowedRoles.includes(r as any)));
      setChecking(false);
    };

    checkRoles();
  }, [user, loading, allowedRoles]);

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
