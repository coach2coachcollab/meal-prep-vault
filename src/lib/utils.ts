import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Round a number to 2 decimal places */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Smart default meal type based on time of day */
export function getDefaultMealType(): "Breakfast" | "Lunch" | "Dinner" | "Snacks" {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 + 30) return "Breakfast";
  if (mins < 15 * 60) return "Lunch";
  if (mins < 20 * 60) return "Dinner";
  return "Snacks";
}
