import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateStreak,
  activityMultipliers,
} from "@/lib/calculations";

describe("Macro Calculator — BMR (Mifflin-St Jeor)", () => {
  it("calculates BMR for a male", () => {
    // 70kg, 175cm, 25yo male: 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
    expect(calculateBMR("male", 70, 175, 25)).toBeCloseTo(1673.75);
  });

  it("calculates BMR for a female", () => {
    // 60kg, 165cm, 30yo female: 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(calculateBMR("female", 60, 165, 30)).toBeCloseTo(1320.25);
  });

  it("male BMR is higher than female BMR at same stats", () => {
    const male = calculateBMR("male", 70, 175, 25);
    const female = calculateBMR("female", 70, 175, 25);
    expect(male).toBeGreaterThan(female);
    expect(male - female).toBeCloseTo(166); // difference is always +5 - (-161) = 166
  });

  it("BMR increases with weight", () => {
    const light = calculateBMR("male", 60, 175, 25);
    const heavy = calculateBMR("male", 90, 175, 25);
    expect(heavy).toBeGreaterThan(light);
    expect(heavy - light).toBeCloseTo(300); // 10 * 30kg = 300
  });

  it("BMR decreases with age", () => {
    const young = calculateBMR("male", 70, 175, 20);
    const old = calculateBMR("male", 70, 175, 40);
    expect(young).toBeGreaterThan(old);
    expect(young - old).toBeCloseTo(100); // 5 * 20 years = 100
  });
});

describe("Macro Calculator — TDEE", () => {
  const bmr = 1674;

  it("sedentary multiplier is 1.2", () => {
    expect(calculateTDEE(bmr, "sedentary")).toBeCloseTo(bmr * 1.2);
  });

  it("moderate multiplier is 1.55", () => {
    expect(calculateTDEE(bmr, "moderate")).toBeCloseTo(bmr * 1.55);
  });

  it("very_active multiplier is 1.9", () => {
    expect(calculateTDEE(bmr, "very_active")).toBeCloseTo(bmr * 1.9);
  });

  it("unknown activity defaults to 1.2", () => {
    expect(calculateTDEE(bmr, "unknown")).toBeCloseTo(bmr * 1.2);
  });
});

describe("Macro Calculator — Full calculation", () => {
  it("calculates complete macros for male, moderate, maintain", () => {
    const result = calculateMacros({
      gender: "male",
      weightKg: 70,
      heightCm: 175,
      age: 25,
      activityLevel: "moderate",
      goal: "maintain",
    });

    // BMR = 1673.75, TDEE = 1673.75 * 1.55 = 2594.3125, calories = same (maintain)
    expect(result.bmr).toBe(1674);
    expect(result.tdee).toBe(2594);
    expect(result.calories).toBe(2594);
    // protein = 70 * 2.2 = 154
    expect(result.protein).toBe(154);
    // fats = (2594 * 0.25) / 9 ≈ 72
    expect(result.fats).toBe(72);
    // carbs = (2594 - 154*4 - 72*9) / 4
    expect(result.carbs).toBeGreaterThan(0);
  });

  it("lose goal reduces calories by 20%", () => {
    const maintain = calculateMacros({
      gender: "male", weightKg: 80, heightCm: 180, age: 30,
      activityLevel: "moderate", goal: "maintain",
    });
    const lose = calculateMacros({
      gender: "male", weightKg: 80, heightCm: 180, age: 30,
      activityLevel: "moderate", goal: "lose",
    });
    expect(lose.calories).toBe(Math.round(maintain.calories * 0.8));
  });

  it("gain goal increases calories by 15%", () => {
    const maintain = calculateMacros({
      gender: "female", weightKg: 60, heightCm: 165, age: 28,
      activityLevel: "light", goal: "maintain",
    });
    const gain = calculateMacros({
      gender: "female", weightKg: 60, heightCm: 165, age: 28,
      activityLevel: "light", goal: "gain",
    });
    expect(gain.calories).toBe(Math.round(maintain.calories * 1.15));
  });

  it("protein is always ~1g per lb of body weight", () => {
    const result = calculateMacros({
      gender: "male", weightKg: 80, heightCm: 180, age: 30,
      activityLevel: "moderate", goal: "maintain",
    });
    expect(result.protein).toBe(Math.round(80 * 2.2));
  });

  it("macros sum approximately to total calories", () => {
    const result = calculateMacros({
      gender: "male", weightKg: 75, heightCm: 178, age: 27,
      activityLevel: "active", goal: "maintain",
    });
    const caloriesFromMacros = result.protein * 4 + result.carbs * 4 + result.fats * 9;
    // Allow rounding tolerance of ±10 cal
    expect(Math.abs(caloriesFromMacros - result.calories)).toBeLessThan(10);
  });
});

describe("Streak Calculation", () => {
  const makeDate = (daysAgo: number): string => {
    const d = new Date("2025-06-15T12:00:00Z");
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };
  const today = new Date("2025-06-15T12:00:00Z");

  it("returns 0 for empty set", () => {
    expect(calculateStreak(new Set(), today)).toBe(0);
  });

  it("returns 1 when only today is active", () => {
    const days = new Set([makeDate(0)]);
    expect(calculateStreak(days, today)).toBe(1);
  });

  it("counts consecutive days including today", () => {
    const days = new Set([makeDate(0), makeDate(1), makeDate(2)]);
    expect(calculateStreak(days, today)).toBe(3);
  });

  it("counts from yesterday if today is not active", () => {
    const days = new Set([makeDate(1), makeDate(2), makeDate(3)]);
    expect(calculateStreak(days, today)).toBe(3);
  });

  it("stops at gaps", () => {
    // Today + yesterday active, then gap, then 3 more days
    const days = new Set([makeDate(0), makeDate(1), makeDate(3), makeDate(4), makeDate(5)]);
    expect(calculateStreak(days, today)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday is active", () => {
    const days = new Set([makeDate(3), makeDate(4)]);
    expect(calculateStreak(days, today)).toBe(0);
  });

  it("handles long streaks", () => {
    const days = new Set<string>();
    for (let i = 0; i < 30; i++) days.add(makeDate(i));
    expect(calculateStreak(days, today)).toBe(30);
  });
});
