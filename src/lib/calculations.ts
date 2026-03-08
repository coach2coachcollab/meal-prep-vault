// Pure calculation functions extracted for testability

export const activityMultipliers: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const goalMultipliers: Record<string, number> = {
  lose: 0.8,
  maintain: 1.0,
  gain: 1.15,
};

export interface MacroInput {
  gender: "male" | "female";
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: string;
  goal: string;
}

export interface MacroResult {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/** Mifflin-St Jeor BMR */
export function calculateBMR(gender: "male" | "female", weightKg: number, heightCm: number, age: number): number {
  if (gender === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = activityMultipliers[activityLevel] ?? 1.2;
  return bmr * multiplier;
}

export function calculateMacros(input: MacroInput): MacroResult {
  const bmr = calculateBMR(input.gender, input.weightKg, input.heightCm, input.age);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  const calories = tdee * (goalMultipliers[input.goal] ?? 1.0);
  const protein = input.weightKg * 2.2; // 1g per lb of body weight
  const fats = (calories * 0.25) / 9;
  const carbs = (calories - protein * 4 - fats * 9) / 4;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  };
}

/** Calculate consecutive streak days from a set of date strings (YYYY-MM-DD) */
export function calculateStreak(activeDays: Set<string>, fromDate?: Date): number {
  const d = fromDate ? new Date(fromDate) : new Date();
  // If today is not active, start checking from yesterday
  if (!activeDays.has(d.toISOString().split("T")[0])) {
    d.setDate(d.getDate() - 1);
  }
  let count = 0;
  while (activeDays.has(d.toISOString().split("T")[0])) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
