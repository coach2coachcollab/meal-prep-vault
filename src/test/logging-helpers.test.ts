import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldSkipServingPicker, buildRelogPayload } from "@/lib/logging-helpers";

describe("shouldSkipServingPicker (vault meal 1-serving skip)", () => {
  it("skips picker when servings is exactly 1", () => {
    expect(shouldSkipServingPicker({ servings: 1 })).toBe(true);
  });

  it("skips picker when servings is missing (defaults to 1)", () => {
    expect(shouldSkipServingPicker({})).toBe(true);
    expect(shouldSkipServingPicker({ servings: null })).toBe(true);
    expect(shouldSkipServingPicker({ servings: 0 })).toBe(true); // 0 → default 1
  });

  it("opens picker when servings is greater than 1", () => {
    expect(shouldSkipServingPicker({ servings: 2 })).toBe(false);
    expect(shouldSkipServingPicker({ servings: 4 })).toBe(false);
    expect(shouldSkipServingPicker({ servings: 10 })).toBe(false);
  });
});

describe("buildRelogPayload (one-tap recent-meals relog)", () => {
  const userId = "user-123";
  const date = "2026-07-20";

  const baseRecent = {
    food_name: "Grilled Chicken Bowl",
    meal_type: "Lunch",
    calories: 520,
    protein_g: 42,
    carbs_g: 38,
    fat_g: 18,
    recipe_id: "recipe-abc",
    servings: 1,
    image_url: "https://cdn.example.com/chicken.jpg",
  };

  it("preserves meal_type, food_name, macros, recipe_id, servings and image_url", () => {
    const p = buildRelogPayload(userId, date, baseRecent);
    expect(p).toEqual({
      user_id: userId,
      date,
      meal_type: "Lunch",
      food_name: "Grilled Chicken Bowl",
      calories: 520,
      protein_g: 42,
      carbs_g: 38,
      fat_g: 18,
      recipe_id: "recipe-abc",
      servings: 1,
      image_url: "https://cdn.example.com/chicken.jpg",
    });
  });

  it("coerces string macros from PostgREST numeric responses", () => {
    const p = buildRelogPayload(userId, date, {
      ...baseRecent,
      calories: "520" as any,
      protein_g: "42.5" as any,
    });
    expect(p.calories).toBe(520);
    expect(p.protein_g).toBe(42.5);
  });

  it("defaults servings to 1 when missing or invalid", () => {
    expect(buildRelogPayload(userId, date, { ...baseRecent, servings: null }).servings).toBe(1);
    expect(buildRelogPayload(userId, date, { ...baseRecent, servings: undefined }).servings).toBe(1);
    expect(buildRelogPayload(userId, date, { ...baseRecent, servings: 0 }).servings).toBe(1);
  });

  it("preserves non-1 servings for multi-serving recipes", () => {
    expect(buildRelogPayload(userId, date, { ...baseRecent, servings: 2 }).servings).toBe(2);
  });

  it("nulls optional fields cleanly (recipe_id, image_url)", () => {
    const p = buildRelogPayload(userId, date, {
      ...baseRecent,
      recipe_id: null,
      image_url: null,
    });
    expect(p.recipe_id).toBeNull();
    expect(p.image_url).toBeNull();
  });

  it("defaults missing macro fields to 0 (never NaN)", () => {
    const p = buildRelogPayload(userId, date, {
      food_name: "Water",
      meal_type: "Snacks",
    });
    expect(p.calories).toBe(0);
    expect(p.protein_g).toBe(0);
    expect(p.carbs_g).toBe(0);
    expect(p.fat_g).toBe(0);
    expect(Number.isNaN(p.calories)).toBe(false);
  });
});

describe("end-to-end: recent-meals relog → supabase insert", () => {
  const insertMock: ReturnType<typeof vi.fn> = vi.fn();
  const fromMock: ReturnType<typeof vi.fn> = vi.fn(() => ({ insert: insertMock }));
  const supabase = { from: fromMock as any };

  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
  });

  async function relog(userId: string, date: string, recent: any) {
    const payload = buildRelogPayload(userId, date, recent);
    const { error } = await supabase.from("journal_entries").insert(payload);
    return { error, payload };
  }

  it("inserts a full journal_entries row with the previously-used meal_type and servings", async () => {
    const { error, payload } = await relog("user-1", "2026-07-20", {
      food_name: "Oatmeal",
      meal_type: "Breakfast",
      calories: 320, protein_g: 12, carbs_g: 54, fat_g: 6,
      recipe_id: "r-oat", servings: 2, image_url: null,
    });

    expect(error).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("journal_entries");
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(payload);
    expect(payload.meal_type).toBe("Breakfast");
    expect(payload.servings).toBe(2);
    expect(payload.user_id).toBe("user-1");
    expect(payload.date).toBe("2026-07-20");
  });

  it("surfaces supabase errors so the caller can roll back optimistic state", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const { error } = await relog("user-1", "2026-07-20", {
      food_name: "X", meal_type: "Lunch", servings: 1,
    });
    expect(error).toEqual({ message: "boom" });
  });
});
