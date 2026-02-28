import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, TrendingUp, Plus, Ruler, Scale, Trash2, Camera, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ProgressLog {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  thighs_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  photo_url: string | null;
}

const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;

export function ProgressTracker() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [useMetric, setUseMetric] = useState(true);
  const [chartField, setChartField] = useState<"weight" | "waist" | "hips" | "body_fat">("weight");
  const [showCompare, setShowCompare] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    weight: "", waist: "", hips: "", chest: "", arms: "", thighs: "", body_fat: "", notes: "",
  });

  useEffect(() => {
    if (user) {
      loadLogs();
      const saved = localStorage.getItem(`preferred_units_${user.id}`);
      if (saved) setUseMetric(saved === "metric");
    }
  }, [user]);

  const loadLogs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("progress_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });
    if (data) setLogs(data);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !user) return null;
    const ext = photoFile.name.split(".").pop();
    const path = `${user.id}/${form.date}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("progress-photos").upload(path, photoFile);
    if (error) {
      toast.error("Photo upload failed");
      return null;
    }
    const { data } = supabase.storage.from("progress-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveLog = async () => {
    if (!user) return;
    setUploading(true);

    const photoUrl = await uploadPhoto();

    const weightKg = form.weight ? (useMetric ? parseFloat(form.weight) : parseFloat(form.weight) / KG_TO_LBS) : null;
    const toMetricCm = (v: string) => v ? (useMetric ? parseFloat(v) : parseFloat(v) / CM_TO_IN) : null;

    const { error } = await supabase.from("progress_logs").upsert({
      user_id: user.id,
      date: form.date,
      weight_kg: weightKg ? Math.round(weightKg * 10) / 10 : null,
      waist_cm: toMetricCm(form.waist) ? Math.round(toMetricCm(form.waist)! * 10) / 10 : null,
      hips_cm: toMetricCm(form.hips) ? Math.round(toMetricCm(form.hips)! * 10) / 10 : null,
      chest_cm: toMetricCm(form.chest) ? Math.round(toMetricCm(form.chest)! * 10) / 10 : null,
      arms_cm: toMetricCm(form.arms) ? Math.round(toMetricCm(form.arms)! * 10) / 10 : null,
      thighs_cm: toMetricCm(form.thighs) ? Math.round(toMetricCm(form.thighs)! * 10) / 10 : null,
      body_fat_pct: form.body_fat ? parseFloat(form.body_fat) : null,
      notes: form.notes || null,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    }, { onConflict: "user_id,date" });

    setUploading(false);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Progress logged! 📊");
      setForm({ date: new Date().toISOString().split("T")[0], weight: "", waist: "", hips: "", chest: "", arms: "", thighs: "", body_fat: "", notes: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      setShowAdd(false);
      loadLogs();
    }
  };

  const deleteLog = async (id: string) => {
    await supabase.from("progress_logs").delete().eq("id", id);
    loadLogs();
    toast.success("Entry removed");
  };

  const displayWeight = (kg: number | null) => {
    if (kg == null) return "—";
    return useMetric ? `${kg} kg` : `${Math.round(kg * KG_TO_LBS * 10) / 10} lbs`;
  };

  const displayMeasure = (cm: number | null) => {
    if (cm == null) return "—";
    return useMetric ? `${cm} cm` : `${Math.round(cm * CM_TO_IN * 10) / 10} in`;
  };

  const chartData = logs.map((l) => {
    const wVal = l.weight_kg != null ? (useMetric ? l.weight_kg : Math.round(l.weight_kg * KG_TO_LBS * 10) / 10) : null;
    const waistVal = l.waist_cm != null ? (useMetric ? l.waist_cm : Math.round(l.waist_cm * CM_TO_IN * 10) / 10) : null;
    const hipsVal = l.hips_cm != null ? (useMetric ? l.hips_cm : Math.round(l.hips_cm * CM_TO_IN * 10) / 10) : null;
    return {
      date: new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      weight: wVal, waist: waistVal, hips: hipsVal, body_fat: l.body_fat_pct,
    };
  });

  const chartConfig: Record<string, { label: string; unit: string; color: string }> = {
    weight: { label: "Weight", unit: useMetric ? "kg" : "lbs", color: "hsl(var(--primary))" },
    waist: { label: "Waist", unit: useMetric ? "cm" : "in", color: "hsl(var(--primary))" },
    hips: { label: "Hips", unit: useMetric ? "cm" : "in", color: "hsl(var(--primary))" },
    body_fat: { label: "Body Fat", unit: "%", color: "hsl(var(--primary))" },
  };

  const current = chartConfig[chartField];
  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];
  const weightChange = firstLog?.weight_kg != null && lastLog?.weight_kg != null
    ? Math.round((lastLog.weight_kg - firstLog.weight_kg) * 10) / 10 : null;

  const photosWithDates = logs.filter((l) => l.photo_url).map((l) => ({
    url: l.photo_url!,
    date: l.date,
    weight: l.weight_kg,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Progress
          </h2>
          <p className="text-sm text-muted-foreground">Track your body over time</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 text-[10px]">
            <button onClick={() => setUseMetric(true)} className={`px-2 py-1 rounded-md ${useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>Metric</button>
            <button onClick={() => setUseMetric(false)} className={`px-2 py-1 rounded-md ${!useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>Imperial</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Log
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground">Current</p>
              <p className="text-sm font-bold">{displayWeight(lastLog?.weight_kg)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground">Start</p>
              <p className="text-sm font-bold">{displayWeight(firstLog?.weight_kg)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground">Change</p>
              {weightChange != null ? (
                <p className={cn("text-sm font-bold flex items-center justify-center gap-0.5", weightChange < 0 ? "text-primary" : "text-destructive")}>
                  {weightChange < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {useMetric ? `${Math.abs(weightChange)} kg` : `${Math.abs(Math.round(weightChange * KG_TO_LBS * 10) / 10)} lbs`}
                </p>
              ) : <p className="text-sm font-bold">—</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Photo comparison */}
      {photosWithDates.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Camera className="h-4 w-4" /> Photo Journey
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowCompare(true)}>
                Compare
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photosWithDates.map((p, i) => (
                <button key={i} onClick={() => setViewPhoto(p.url)} className="shrink-0 w-16 space-y-1">
                  <AspectRatio ratio={3 / 4} className="rounded-md overflow-hidden bg-muted">
                    <img src={p.url} alt={`Progress ${p.date}`} className="object-cover w-full h-full" />
                  </AspectRatio>
                  <p className="text-[9px] text-muted-foreground text-center truncate">
                    {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {logs.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Trend</CardTitle>
              <div className="flex gap-1 text-[10px]">
                {(["weight", "waist", "hips", "body_fat"] as const).map((f) => (
                  <button key={f} onClick={() => setChartField(f)} className={cn("px-2 py-0.5 rounded", chartField === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {chartConfig[f].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} className="text-muted-foreground" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: number) => [`${value} ${current.unit}`, current.label]} />
                <Line type="monotone" dataKey={chartField} stroke={current.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {logs.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">History</h3>
          {[...logs].reverse().map((log) => (
            <Card key={log.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {log.photo_url && (
                    <button onClick={() => setViewPhoto(log.photo_url)} className="shrink-0 w-12 h-16 rounded-md overflow-hidden bg-muted">
                      <img src={log.photo_url} alt="Progress" className="object-cover w-full h-full" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-sm">
                      {log.weight_kg != null && <span className="font-medium">{displayWeight(log.weight_kg)}</span>}
                      {log.waist_cm != null && <span>Waist: {displayMeasure(log.waist_cm)}</span>}
                      {log.hips_cm != null && <span>Hips: {displayMeasure(log.hips_cm)}</span>}
                      {log.body_fat_pct != null && <span>BF: {log.body_fat_pct}%</span>}
                    </div>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteLog(log.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Ruler className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No progress logged yet. Tap "Log" to start tracking!</p>
          </CardContent>
        </Card>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setPhotoFile(null); setPhotoPreview(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Log Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            {/* Photo upload */}
            <div className="space-y-1">
              <Label className="text-xs">Progress Photo (optional)</Label>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              {photoPreview ? (
                <div className="relative">
                  <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted border">
                    <img src={photoPreview} alt="Preview" className="object-cover w-full h-full" />
                  </AspectRatio>
                  <Button variant="secondary" size="sm" className="absolute bottom-2 right-2 text-xs" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                    Remove
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-xs">Tap to add a photo</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Weight ({useMetric ? "kg" : "lbs"})</Label>
              <Input type="number" step="0.1" placeholder={useMetric ? "70.0" : "154.0"} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Waist ({useMetric ? "cm" : "in"})</Label>
                <Input type="number" step="0.1" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hips ({useMetric ? "cm" : "in"})</Label>
                <Input type="number" step="0.1" value={form.hips} onChange={(e) => setForm({ ...form, hips: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chest ({useMetric ? "cm" : "in"})</Label>
                <Input type="number" step="0.1" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arms ({useMetric ? "cm" : "in"})</Label>
                <Input type="number" step="0.1" value={form.arms} onChange={(e) => setForm({ ...form, arms: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thighs ({useMetric ? "cm" : "in"})</Label>
                <Input type="number" step="0.1" value={form.thighs} onChange={(e) => setForm({ ...form, thighs: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body Fat (%)</Label>
                <Input type="number" step="0.1" value={form.body_fat} onChange={(e) => setForm({ ...form, body_fat: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea placeholder="How do you feel?" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveLog} disabled={uploading}>
              {uploading ? "Saving..." : "Save Progress"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-sm p-2">
          {viewPhoto && (
            <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden">
              <img src={viewPhoto} alt="Progress photo" className="object-cover w-full h-full" />
            </AspectRatio>
          )}
        </DialogContent>
      </Dialog>

      {/* Side-by-side comparison */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Compare Photos</DialogTitle>
          </DialogHeader>
          {photosWithDates.length >= 2 ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground text-center font-medium">
                    {new Date(photosWithDates[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted">
                    <img src={photosWithDates[0].url} alt="First" className="object-cover w-full h-full" />
                  </AspectRatio>
                  {photosWithDates[0].weight != null && (
                    <p className="text-xs text-center font-medium">{displayWeight(photosWithDates[0].weight)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground text-center font-medium">
                    {new Date(photosWithDates[photosWithDates.length - 1].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted">
                    <img src={photosWithDates[photosWithDates.length - 1].url} alt="Latest" className="object-cover w-full h-full" />
                  </AspectRatio>
                  {photosWithDates[photosWithDates.length - 1].weight != null && (
                    <p className="text-xs text-center font-medium">{displayWeight(photosWithDates[photosWithDates.length - 1].weight)}</p>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">First vs Latest</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Upload at least 2 photos to compare.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
