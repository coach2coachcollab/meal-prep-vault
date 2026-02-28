import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, TrendingUp, Plus, Ruler, Scale, Trash2, Camera, ImageIcon, Target, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

interface ProgressPhoto {
  id: string;
  progress_log_id: string;
  angle: "front" | "back" | "side";
  photo_url: string;
}

type Angle = "front" | "back" | "side";
const ANGLES: Angle[] = ["front", "back", "side"];
const ANGLE_LABELS: Record<Angle, string> = { front: "Front", back: "Back", side: "Side" };

const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;

export function ProgressTracker() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [logPhotos, setLogPhotos] = useState<Record<string, ProgressPhoto[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [useMetric, setUseMetric] = useState(true);
  const [chartField, setChartField] = useState<"weight" | "waist" | "hips" | "body_fat">("weight");
  const [showCompare, setShowCompare] = useState(false);
  const [compareAngle, setCompareAngle] = useState<Angle>("front");
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [viewPhotoList, setViewPhotoList] = useState<{ url: string; label: string }[]>([]);
  const [viewPhotoIndex, setViewPhotoIndex] = useState(0);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [showGoalEdit, setShowGoalEdit] = useState(false);

  // Multi-angle photo state
  const [angleFiles, setAngleFiles] = useState<Record<Angle, File | null>>({ front: null, back: null, side: null });
  const [anglePreviews, setAnglePreviews] = useState<Record<Angle, string | null>>({ front: null, back: null, side: null });
  const fileRefs = {
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
  };

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    weight: "", waist: "", hips: "", chest: "", arms: "", thighs: "", body_fat: "", notes: "",
  });

  useEffect(() => {
    if (user) {
      loadLogs();
      loadGoalWeight();
      const saved = localStorage.getItem(`preferred_units_${user.id}`);
      if (saved) setUseMetric(saved === "metric");
    }
  }, [user]);

  const loadGoalWeight = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("goal_weight_kg").eq("user_id", user.id).single();
    if (data?.goal_weight_kg) setGoalWeightKg(data.goal_weight_kg);
  };

  const saveGoalWeight = async () => {
    if (!user || !goalInput) return;
    const kg = useMetric ? parseFloat(goalInput) : parseFloat(goalInput) / KG_TO_LBS;
    const rounded = Math.round(kg * 10) / 10;
    const { error } = await supabase.from("profiles").update({ goal_weight_kg: rounded }).eq("user_id", user.id);
    if (error) { toast.error("Failed to save goal"); return; }
    setGoalWeightKg(rounded);
    setGoalInput("");
    setShowGoalEdit(false);
    toast.success("Goal weight set! 🎯");
  };

  const loadLogs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("progress_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });
    if (data) {
      setLogs(data);
      // Load all photos for these logs
      const logIds = data.map((l) => l.id);
      if (logIds.length > 0) {
        const { data: photos } = await supabase
          .from("progress_photos")
          .select("*")
          .in("progress_log_id", logIds);
        if (photos) {
          const grouped: Record<string, ProgressPhoto[]> = {};
          (photos as ProgressPhoto[]).forEach((p) => {
            if (!grouped[p.progress_log_id]) grouped[p.progress_log_id] = [];
            grouped[p.progress_log_id].push(p);
          });
          setLogPhotos(grouped);
        }
      }
    }
  };

  const handleAnglePhotoSelect = (angle: Angle, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setAngleFiles((prev) => ({ ...prev, [angle]: file }));
    setAnglePreviews((prev) => ({ ...prev, [angle]: URL.createObjectURL(file) }));
  };

  const openPhotoViewer = (photos: { url: string; label: string }[], startIndex = 0) => {
    setViewPhotoList(photos);
    setViewPhotoIndex(startIndex);
    setViewPhoto("open");
  };

  const openLogPhotos = (logId: string, startAngle?: string) => {
    const photos = logPhotos[logId] || [];
    if (photos.length === 0) return;
    const list = photos.map((p) => ({ url: p.photo_url, label: ANGLE_LABELS[p.angle] || p.angle }));
    const idx = startAngle ? photos.findIndex((p) => p.angle === startAngle) : 0;
    openPhotoViewer(list, Math.max(0, idx));
  };

  const uploadAnglePhoto = async (angle: Angle, file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${form.date}-${angle}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("progress-photos").upload(path, file);
    if (error) {
      toast.error(`${ANGLE_LABELS[angle]} photo upload failed`);
      return null;
    }
    const { data } = supabase.storage.from("progress-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const resetPhotoState = () => {
    setAngleFiles({ front: null, back: null, side: null });
    setAnglePreviews({ front: null, back: null, side: null });
  };

  const saveLog = async () => {
    if (!user) return;
    setUploading(true);

    const weightKg = form.weight ? (useMetric ? parseFloat(form.weight) : parseFloat(form.weight) / KG_TO_LBS) : null;
    const toMetricCm = (v: string) => v ? (useMetric ? parseFloat(v) : parseFloat(v) / CM_TO_IN) : null;

    // Use first available photo as the legacy photo_url for thumbnails
    const firstFile = angleFiles.front || angleFiles.side || angleFiles.back;
    let legacyPhotoUrl: string | null = null;
    if (firstFile) {
      const ext = firstFile.name.split(".").pop();
      const path = `${user.id}/${form.date}-thumb-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("progress-photos").upload(path, firstFile);
      if (!error) {
        legacyPhotoUrl = supabase.storage.from("progress-photos").getPublicUrl(path).data.publicUrl;
      }
    }

    const { data: logData, error } = await supabase.from("progress_logs").upsert({
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
      ...(legacyPhotoUrl ? { photo_url: legacyPhotoUrl } : {}),
    }, { onConflict: "user_id,date" }).select("id").single();

    if (error || !logData) {
      setUploading(false);
      toast.error("Failed to save");
      return;
    }

    // Upload angle photos
    for (const angle of ANGLES) {
      const file = angleFiles[angle];
      if (!file) continue;
      const url = await uploadAnglePhoto(angle, file);
      if (url) {
        await supabase.from("progress_photos").upsert({
          progress_log_id: logData.id,
          user_id: user.id,
          angle,
          photo_url: url,
        }, { onConflict: "progress_log_id,angle" });
      }
    }

    setUploading(false);
    toast.success("Progress logged! 📊");
    setForm({ date: new Date().toISOString().split("T")[0], weight: "", waist: "", hips: "", chest: "", arms: "", thighs: "", body_fat: "", notes: "" });
    resetPhotoState();
    setShowAdd(false);
    loadLogs();
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

  // Logs that have any photos
  const logsWithPhotos = logs.filter((l) => logPhotos[l.id]?.length > 0);

  // For comparison: find first and last logs that have the selected angle
  const logsWithAngle = (angle: Angle) =>
    logsWithPhotos.filter((l) => logPhotos[l.id]?.some((p) => p.angle === angle));

  const getPhotoUrl = (logId: string, angle: Angle) =>
    logPhotos[logId]?.find((p) => p.angle === angle)?.photo_url || null;

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

      {/* Goal weight card */}
      {(() => {
        const currentWeight = lastLog?.weight_kg;
        const startWeight = firstLog?.weight_kg;
        if (goalWeightKg && currentWeight != null && startWeight != null) {
          const totalToLose = startWeight - goalWeightKg;
          const lost = startWeight - currentWeight;
          const progressPct = totalToLose !== 0 ? Math.min(100, Math.max(0, Math.round((lost / totalToLose) * 100))) : 0;
          const remaining = currentWeight - goalWeightKg;
          const reached = remaining <= 0;
          return (
            <Card className={reached ? "border-primary/50 bg-primary/5" : ""}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold">Goal Weight</span>
                  </div>
                  <button onClick={() => { setGoalInput(useMetric ? String(goalWeightKg) : String(Math.round(goalWeightKg * KG_TO_LBS * 10) / 10)); setShowGoalEdit(true); }} className="text-[10px] text-muted-foreground hover:text-foreground">Edit</button>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-lg font-bold">{displayWeight(goalWeightKg)}</span>
                  {reached ? (
                    <span className="text-xs font-medium text-primary flex items-center gap-1"><Check className="h-3 w-3" /> Goal reached!</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{displayWeight(Math.round(remaining * 10) / 10)} to go</span>
                  )}
                </div>
                <Progress value={progressPct} className="h-2" />
                <p className="text-[10px] text-muted-foreground text-right">{progressPct}% there</p>
              </CardContent>
            </Card>
          );
        }
        if (!goalWeightKg && logs.length > 0) {
          return (
            <Card className="border-dashed">
              <CardContent className="py-4">
                {showGoalEdit ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Goal Weight ({useMetric ? "kg" : "lbs"})</Label>
                      <Input type="number" step="0.1" placeholder={useMetric ? "65.0" : "143.0"} value={goalInput} onChange={(e) => setGoalInput(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={saveGoalWeight}>Set</Button>
                  </div>
                ) : (
                  <button onClick={() => setShowGoalEdit(true)} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Target className="h-4 w-4" /> Set a goal weight
                  </button>
                )}
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Photo journey with angle tabs */}
      {logsWithPhotos.length >= 2 && (
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
              {logsWithPhotos.map((log) => {
                const photos = logPhotos[log.id] || [];
                const firstPhoto = photos[0];
                return (
                  <button key={log.id} onClick={() => openLogPhotos(log.id)} className="shrink-0 w-16 space-y-1">
                    <AspectRatio ratio={3 / 4} className="rounded-md overflow-hidden bg-muted relative">
                      <img src={firstPhoto?.photo_url} alt={`Progress ${log.date}`} className="object-cover w-full h-full" />
                      {photos.length > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 bg-background/80 text-[8px] font-medium px-1 rounded">{photos.length}</span>
                      )}
                    </AspectRatio>
                    <p className="text-[9px] text-muted-foreground text-center truncate">
                      {new Date(log.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </button>
                );
              })}
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
          {[...logs].reverse().map((log) => {
            const photos = logPhotos[log.id] || [];
            return (
              <Card key={log.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    {photos.length > 0 && (
                      <div className="shrink-0 flex gap-1">
                        {photos.map((p) => (
                          <button key={p.id} onClick={() => openLogPhotos(log.id, p.angle)} className="w-10 h-14 rounded-md overflow-hidden bg-muted relative">
                            <img src={p.photo_url} alt={p.angle} className="object-cover w-full h-full" />
                            <span className="absolute bottom-0 inset-x-0 bg-background/70 text-[7px] text-center capitalize">{p.angle[0]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!photos.length && log.photo_url && (
                      <button onClick={() => openPhotoViewer([{ url: log.photo_url!, label: "Photo" }])} className="shrink-0 w-12 h-16 rounded-md overflow-hidden bg-muted">
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
            );
          })}
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
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetPhotoState(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Log Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            {/* Multi-angle photo upload */}
            <div className="space-y-2">
              <Label className="text-xs">Progress Photos (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                {ANGLES.map((angle) => (
                  <div key={angle} className="space-y-1">
                    <input
                      ref={fileRefs[angle]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleAnglePhotoSelect(angle, e)}
                    />
                    {anglePreviews[angle] ? (
                      <div className="relative">
                        <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted border">
                          <img src={anglePreviews[angle]!} alt={angle} className="object-cover w-full h-full" />
                        </AspectRatio>
                        <button
                          onClick={() => {
                            setAngleFiles((prev) => ({ ...prev, [angle]: null }));
                            setAnglePreviews((prev) => ({ ...prev, [angle]: null }));
                          }}
                          className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRefs[angle].current?.click()}
                        className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg aspect-[3/4] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 transition-colors"
                      >
                        <Camera className="h-5 w-5" />
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center font-medium">{ANGLE_LABELS[angle]}</p>
                  </div>
                ))}
              </div>
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

      {/* Photo viewer with swipe */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-sm p-2">
          {viewPhotoList.length > 0 && (
            <div
              className="relative"
              onTouchStart={(e) => { (e.currentTarget as any)._touchX = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._touchX;
                if (startX == null) return;
                const diff = e.changedTouches[0].clientX - startX;
                if (Math.abs(diff) > 50) {
                  if (diff < 0 && viewPhotoIndex < viewPhotoList.length - 1) setViewPhotoIndex((i) => i + 1);
                  if (diff > 0 && viewPhotoIndex > 0) setViewPhotoIndex((i) => i - 1);
                }
              }}
            >
              <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden">
                <img src={viewPhotoList[viewPhotoIndex]?.url} alt="Progress photo" className="object-cover w-full h-full" />
              </AspectRatio>
              {/* Angle label */}
              <span className="absolute top-2 left-2 bg-background/80 text-xs font-medium px-2 py-0.5 rounded-md">
                {viewPhotoList[viewPhotoIndex]?.label}
              </span>
              {/* Navigation arrows */}
              {viewPhotoList.length > 1 && (
                <>
                  {viewPhotoIndex > 0 && (
                    <button
                      onClick={() => setViewPhotoIndex((i) => i - 1)}
                      className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {viewPhotoIndex < viewPhotoList.length - 1 && (
                    <button
                      onClick={() => setViewPhotoIndex((i) => i + 1)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  {/* Dots */}
                  <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                    {viewPhotoList.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setViewPhotoIndex(i)}
                        className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === viewPhotoIndex ? "bg-primary" : "bg-background/60")}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Side-by-side comparison with angle selector */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Compare Photos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Angle selector */}
            <div className="flex gap-1 justify-center">
              {ANGLES.map((a) => (
                <button
                  key={a}
                  onClick={() => setCompareAngle(a)}
                  className={cn("px-3 py-1 rounded-md text-xs transition-colors", compareAngle === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >
                  {ANGLE_LABELS[a]}
                </button>
              ))}
            </div>

            {(() => {
              const matching = logsWithAngle(compareAngle);
              if (matching.length < 2) {
                return <p className="text-sm text-muted-foreground text-center py-6">Need at least 2 {ANGLE_LABELS[compareAngle].toLowerCase()} photos to compare.</p>;
              }
              const first = matching[0];
              const last = matching[matching.length - 1];
              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground text-center font-medium">
                        {new Date(first.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted">
                        <img src={getPhotoUrl(first.id, compareAngle)!} alt="First" className="object-cover w-full h-full" />
                      </AspectRatio>
                      {first.weight_kg != null && <p className="text-xs text-center font-medium">{displayWeight(first.weight_kg)}</p>}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground text-center font-medium">
                        {new Date(last.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-muted">
                        <img src={getPhotoUrl(last.id, compareAngle)!} alt="Latest" className="object-cover w-full h-full" />
                      </AspectRatio>
                      {last.weight_kg != null && <p className="text-xs text-center font-medium">{displayWeight(last.weight_kg)}</p>}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">First vs Latest — {ANGLE_LABELS[compareAngle]} View</p>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal weight edit dialog */}
      <Dialog open={showGoalEdit && goalWeightKg != null} onOpenChange={setShowGoalEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Edit Goal Weight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Goal Weight ({useMetric ? "kg" : "lbs"})</Label>
              <Input type="number" step="0.1" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} />
            </div>
            <Button className="w-full" onClick={saveGoalWeight}>Update Goal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
