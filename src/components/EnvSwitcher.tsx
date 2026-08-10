import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getActiveEnv, getEnvConfig, ENV_KEY, type AppEnv } from "@/integrations/supabase/client";
import { FlaskConical, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EnvSwitcher({ open, onClose }: Props) {
  const [active, setActiveState] = useState<AppEnv>(getActiveEnv());
  const qaConfig = getEnvConfig("qa");
  const [qaUrl, setQaUrl] = useState(qaConfig.url);
  const [qaKey, setQaKey] = useState(qaConfig.key);

  const apply = (env: AppEnv) => {
    if (env === "qa" && (!qaUrl.startsWith("https://") || !qaKey)) {
      toast.error("Enter your QA Supabase URL and anon key first.");
      return;
    }
    if (env === "qa") {
      localStorage.setItem("nutricoach_qa_url", qaUrl);
      localStorage.setItem("nutricoach_qa_key", qaKey);
    }
    localStorage.setItem(ENV_KEY, env);
    localStorage.removeItem("nutricoach_demo_mode");
    toast.success(`Switched to ${env.toUpperCase()} — reloading…`);
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Environment</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* PROD */}
          <button
            onClick={() => setActiveState("prod")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
              active === "prod" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Production</p>
              <p className="text-xs text-muted-foreground truncate">yovtootzxrgfqkllqyxp.supabase.co</p>
            </div>
            {active === "prod" && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {/* QA */}
          <button
            onClick={() => setActiveState("qa")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
              active === "qa" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <FlaskConical className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">QA / Staging</p>
              <p className="text-xs text-muted-foreground">{qaUrl ? qaUrl.replace("https://", "").split(".")[0] + ".supabase.co" : "Not configured"}</p>
            </div>
            {active === "qa" && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {/* QA config fields */}
          {active === "qa" && (
            <div className="space-y-3 pt-1 pl-1">
              <div className="space-y-1.5">
                <Label className="text-xs">QA Supabase URL</Label>
                <Input
                  placeholder="https://xxxx.supabase.co"
                  value={qaUrl}
                  onChange={(e) => setQaUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">QA Anon Key</Label>
                <Input
                  placeholder="eyJhbGci..."
                  value={qaKey}
                  onChange={(e) => setQaKey(e.target.value)}
                  className="text-sm font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Create a new project at{" "}
                <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline text-primary">
                  supabase.com
                </a>{" "}
                and run the same migrations to get a clean QA database.
              </p>
            </div>
          )}

          <Button
            className="w-full rounded-full"
            onClick={() => apply(active)}
          >
            Apply & Reload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
