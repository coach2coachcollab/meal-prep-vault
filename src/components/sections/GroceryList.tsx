import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GroceryItem {
  id: string;
  ingredient: string;
  quantity: string | null;
  is_checked: boolean;
}

export function GroceryList() {
  const { user } = useAuth();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [listId, setListId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadOrCreateList();
  }, [user]);

  const loadOrCreateList = async () => {
    if (!user) return;
    // Get or create a default grocery list
    let { data: lists } = await supabase
      .from("grocery_lists")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    let id: string;
    if (lists && lists.length > 0) {
      id = lists[0].id;
    } else {
      const { data } = await supabase
        .from("grocery_lists")
        .insert({ user_id: user.id, name: "My Grocery List" })
        .select("id")
        .single();
      if (!data) return;
      id = data.id;
    }
    setListId(id);
    loadItems(id);
  };

  const loadItems = async (id: string) => {
    const { data } = await supabase
      .from("grocery_list_items")
      .select("*")
      .eq("grocery_list_id", id)
      .order("created_at", { ascending: true });
    if (data) setItems(data);
  };

  const addItem = async () => {
    if (!listId || !newItem.trim()) return;
    const { error } = await supabase.from("grocery_list_items").insert({
      grocery_list_id: listId,
      ingredient: newItem,
      quantity: newQuantity || null,
    });
    if (!error) {
      setNewItem("");
      setNewQuantity("");
      loadItems(listId);
    }
  };

  const toggleItem = async (item: GroceryItem) => {
    await supabase
      .from("grocery_list_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);
    loadItems(listId!);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("grocery_list_items").delete().eq("id", id);
    loadItems(listId!);
  };

  const clearChecked = async () => {
    if (!listId) return;
    await supabase
      .from("grocery_list_items")
      .delete()
      .eq("grocery_list_id", listId)
      .eq("is_checked", true);
    loadItems(listId);
    toast.success("Checked items cleared");
  };

  const checkedCount = items.filter((i) => i.is_checked).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Grocery List
          </h2>
          <p className="text-muted-foreground">
            {items.length} items · {checkedCount} checked
          </p>
        </div>
        {checkedCount > 0 && (
          <Button variant="outline" size="sm" onClick={clearChecked}>
            Clear Checked
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Add item..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="flex-1"
            />
            <Input
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="w-24"
            />
            <Button onClick={addItem}><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  item.is_checked ? "bg-muted/50 opacity-60" : "bg-card"
                }`}
              >
                <Checkbox
                  checked={item.is_checked}
                  onCheckedChange={() => toggleItem(item)}
                />
                <span className={`flex-1 ${item.is_checked ? "line-through" : ""}`}>
                  {item.ingredient}
                </span>
                {item.quantity && (
                  <span className="text-sm text-muted-foreground">{item.quantity}</span>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItem(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Your grocery list is empty. Add items above!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
