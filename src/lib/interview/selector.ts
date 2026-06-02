import type { Question } from "@/lib/types";

export interface SelectorConfig {
  mode: "sequential" | "random";
  count: number | "all";
  rangeStart?: number; // 1-based, inclusive
  rangeEnd?: number; // 1-based, inclusive
}

export function selectQuestions(all: Question[], config: SelectorConfig): Question[] {
  const start = Math.max(1, config.rangeStart ?? 1);
  const end = Math.min(all.length, config.rangeEnd ?? all.length);
  let pool = all.slice(start - 1, end);

  if (config.mode === "random") {
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  if (config.count !== "all") {
    pool = pool.slice(0, Math.max(0, config.count));
  }
  return pool;
}
