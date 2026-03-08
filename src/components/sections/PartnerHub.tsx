import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Lock, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const categories = ["All", "Nutrition", "Supplements", "Fitness", "Recovery", "Testing", "Apparel"];

interface Partner {
  id: string;
  name: string;
  category: string;
  description: string | null;
  discount_label: string | null;
  promo_code: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_members_only: boolean;
  is_featured: boolean;
  added_at: string;
}

export function PartnerHub() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    const { data } = await supabase.from("partners").select("*").eq("is_active", true).order("is_featured", { ascending: false });
    if (data) setPartners(data);
  };

  const filtered = activeCategory === "All" ? partners : partners.filter((p) => p.category === activeCategory);

  const isNew = (dateStr: string) => {
    const d = new Date(dateStr);
    return (Date.now() - d.getTime()) < 14 * 24 * 60 * 60 * 1000;
  };

  const trackClick = async (partnerId: string, action: string) => {
    if (!user) return;
    await supabase.from("partner_clicks").insert({ partner_id: partnerId, user_id: user.id, action });
  };

  const copyCode = (code: string, partnerId: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Promo code copied!");
    trackClick(partnerId, "copy_code");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-icon-bg flex items-center justify-center"><Sparkles className="h-5 w-5 text-foreground" /></div>
          Coach-Approved Deals
        </h2>
        <p className="text-sm text-section-label font-semibold">Vetted products and services we actually use and believe in</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((c) => (
          <Badge
            key={c}
            variant={activeCategory === c ? "default" : "outline"}
            className={cn("cursor-pointer whitespace-nowrap px-3 py-1.5", activeCategory === c && "bg-primary text-primary-foreground")}
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </Badge>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No deals available in this category yet.</CardContent></Card>
        )}
        {filtered.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-4">
                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 text-2xl">
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover rounded-lg" /> : <Sparkles className="h-6 w-6 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                    {isNew(p.added_at) && <Badge className="text-[10px] bg-primary text-primary-foreground">NEW</Badge>}
                    {p.is_members_only && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {p.discount_label && (
                      <Badge variant="outline" className="text-[10px] border-primary text-primary font-bold">{p.discount_label}</Badge>
                    )}
                    <Button size="sm" variant="default" className="ml-auto h-7 text-xs" onClick={() => { setSelectedPartner(p); trackClick(p.id, "view"); }}>
                      Get Deal
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deal sheet */}
      <Sheet open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          {selectedPartner && (
            <div className="space-y-4 pb-4">
              <SheetHeader>
                <SheetTitle>{selectedPartner.name}</SheetTitle>
              </SheetHeader>
              <p className="text-sm text-muted-foreground">{selectedPartner.description}</p>
              {selectedPartner.discount_label && (
                <div className="bg-primary/10 rounded-lg p-4 text-center">
                  <p className="text-lg font-bold text-primary">{selectedPartner.discount_label}</p>
                </div>
              )}
              {selectedPartner.promo_code && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-4 py-2 rounded text-sm font-mono text-center">{selectedPartner.promo_code}</code>
                  <Button variant="outline" size="sm" onClick={() => copyCode(selectedPartner.promo_code!, selectedPartner.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {selectedPartner.website_url && (
                <Button className="w-full" onClick={() => { window.open(selectedPartner.website_url!, "_blank"); trackClick(selectedPartner.id, "visit"); }}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Visit Website
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
