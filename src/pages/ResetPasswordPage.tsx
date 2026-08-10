import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(true);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();

  useSeo({
    title: "Set New Password",
    description: "Choose a new password for your account.",
    canonicalPath: "/reset-password",
  });

  useEffect(() => {
    const init = async () => {
      // PKCE flow: code comes in as a query param
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setInvalid(true);
          } else {
            setHasSession(true);
          }
        } catch {
          setInvalid(true);
        }
        setExchanging(false);
        return;
      }

      // Implicit flow: type=recovery in URL hash
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        setHasSession(true);
        setExchanging(false);
        return;
      }

      // Listen for PASSWORD_RECOVERY event (fired by Supabase client on redirect)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setHasSession(true);
          setExchanging(false);
        }
      });

      // Give auth state change a moment to fire
      const timeout = setTimeout(() => {
        setExchanging(false);
        setInvalid(true);
      }, 3000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success("Password updated!");
      await supabase.auth.signOut();
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-0.5">
              <span className="text-2xl font-black text-foreground tracking-tight">nutri</span>
              <span className="text-2xl font-black text-primary tracking-tight">coach</span>
              <span className="text-2xl font-black text-primary">.</span>
            </div>
          </div>
          <CardTitle className="text-xl font-bold">
            {success ? "Password Updated" : "Set New Password"}
          </CardTitle>
          <CardDescription>
            {success
              ? "Your password has been changed. Sign in to continue."
              : "Choose a strong password for your account."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {exchanging ? (
            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Verifying your reset link…</p>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <Button className="w-full rounded-full" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </div>
          ) : invalid ? (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Button className="w-full rounded-full" onClick={() => navigate("/forgot-password")}>
                Request New Link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</> : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
