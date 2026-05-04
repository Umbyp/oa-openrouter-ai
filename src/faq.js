import { readFile } from "node:fs/promises";

let cachedFaq = null;

export async function loadFaq() {
  if (cachedFaq) return cachedFaq;

  const raw = await readFile(new URL("../data/faq.json", import.meta.url), "utf8");
  cachedFaq = JSON.parse(raw);
  return cachedFaq;
}

export async function findFaqHints(question, limit = 3) {
  const faq = await loadFaq();
  const normalized = question.toLowerCase();

  return faq
    .map((item) => {
      const score = item.keywords.reduce((total, keyword) => {
        return normalized.includes(keyword.toLowerCase()) ? total + 1 : total;
      }, 0);

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
