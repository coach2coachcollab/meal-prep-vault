import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Round a number to 2 decimal places */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
