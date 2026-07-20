/**
 * Shared helpers for the fast meal-logging flows (recent-meals relog + vault picker).
 * Extracted so they can be covered by tests without rendering the full sections.
 */

export type RecentMealLike = {
  food_name: string;
  meal_type: string;
  calories?: number | string | null;
  protein_g?: number | string | null;
  carbs_g?: number | string | null;
  fat_g?: number | string | null;
  recipe_id?: string | null;
  servings?: number | string | null;
  image_url?: string | null;
};

export type RelogPayload = {
  user_id: string;
  date: string;
  meal_type: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  recipe_id: string | null;
  servings: number;
  image_url: string | null;
};

/**
 * A vault meal with a single serving should log immediately — skip the servings picker.
 */
export function shouldSkipServingPicker(meal: { servings?: number | null }): boolean {
  return (meal?.servings || 1) === 1;
}

/**
 * Builds the insert payload for a one-tap re-log of a recent journal entry.
 * Coerces string/null numeric fields defensively and defaults servings to 1.
 */
export function buildRelogPayload(
  userId: string,
  date: string,
  recent: RecentMealLike,
): RelogPayload {
  const num = (v: unknown) => Number(v) || 0;
  return {
    user_id: userId,
    date,
    meal_type: recent.meal_type,
    food_name: recent.food_name,
    calories: num(recent.calories),
    protein_g: num(recent.protein_g),
    carbs_g: num(recent.carbs_g),
    fat_g: num(recent.fat_g),
    recipe_id: recent.recipe_id ?? null,
    servings: Number(recent.servings) || 1,
    image_url: recent.image_url ?? null,
  };
}
