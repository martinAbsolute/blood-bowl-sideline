"use client";
import { useFormatter } from "next-intl";

export function useGold() {
  const format = useFormatter();
  return (value: number) => `${format.number(value / 1000, "gold")}k`;
}
