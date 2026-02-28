import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const channels = [
  { id: "wins", label: "🏆 Wins & Progress" },
  { id: "meals", label: "🥗 Meal Sharing" },
  { id: "questions", label: "❓ Questions" },
];

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onCreated: () => void;
}

export function CreatePostDialog({ open, onClose, userId, onCreated }: CreatePostDialogProps) {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("wins");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);

    let imageUrl: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `community/${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadError) {
        toast.error("Failed to upload image");
        setPosting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("community_posts").insert({
      user_id: userId,
      channel,
      text: text.trim(),
      image_url: imageUrl,
    });

    if (error) {
      toast.error("Failed to create post");
    } else {
      toast.success("Posted!");
      setText("");
      removeImage();
      onCreated();
      onClose();
    }
    setPosting(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Post</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Share something with the community..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />

          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-7 w-7 rounded-full"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-2" /> Add Photo
            </Button>
            <Button className="flex-1" onClick={handlePost} disabled={posting || !text.trim()}>
              <Send className="h-4 w-4 mr-2" /> {posting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
