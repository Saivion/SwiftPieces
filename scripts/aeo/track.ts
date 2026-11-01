/**
 * Record Google and AI visibility of swiftpieces.com for the developer questions in prompts.json.
 *
 * Google, optional: GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX, or SERPAPI_KEY.
 * AI, optional: OPENAI_API_KEY, PERPLEXITY_API_KEY.
 * Models: OPENAI_MODEL (default gpt-4o-mini), PERPLEXITY_MODEL (default sonar).
 *
 * With no keys, write a dated CSV of blank result cells to scripts/aeo/out/ and print the same
 * checklist. Blank cells are not results. Do not fill them in by guessing.
 *
 *   npx tsx scripts/aeo/track.ts
 *   npx tsx scripts/aeo/track.ts --checklist
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type PromptFile = {
  site: string;
  mention: string[];
  /** The sister site. A hit or mention there is noted, never counted as this site's. */
  otherSite: string;
  questions: { id: string; buyerQuestion: string; target: string; google: string[]; ai: string[] }[];
};

export type TrackRow = {
  date: string;
  question_id: string;
  buyer_question: string;
  channel: "google" | "ai";
  engine: string;
  prompt: string;
  google_present: string;
  google_rank: string;
  google_url: string;
  ai_mentioned: string;
  ai_citation: string;
  notes: string;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const COLUMNS: (keyof TrackRow)[] = [
  "date",
  "question_id",
  "buyer_question",
  "channel",
  "engine",
  "prompt",
  "google_present",
  "google_rank",
  "google_url",
  "ai_mentioned",
  "ai_citation",
  "notes",
];

export function loadPrompts(path = join(HERE, "prompts.json")): PromptFile {
  return JSON.parse(readFileSync(path, "utf8")) as PromptFile;
}

export function blankRows(file: PromptFile, date: string): TrackRow[] {
  const rows: TrackRow[] = [];
  for (const question of file.questions) {
    for (const prompt of question.google) {
      rows.push({
        date,
        question_id: question.id,
        buyer_question: question.buyerQuestion,
        channel: "google",
        engine: "google",
        prompt,
        google_present: "",
        google_rank: "",
        google_url: "",
        ai_mentioned: "",
        ai_citation: "",
        notes: "",
      });
    }
    for (const prompt of question.ai) {
      rows.push({
        date,
        question_id: question.id,
        buyer_question: question.buyerQuestion,
        channel: "ai",
        engine: "",
        prompt,
        google_present: "",
        google_rank: "",
        google_url: "",
        ai_mentioned: "",
        ai_citation: "",
        notes: "",
      });
    }
  }
  return rows;
}

export function toCsv(rows: TrackRow[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((key) => escape(row[key])).join(","))].join("\n") + "\n";
}

type Hit = { url: string; title?: string };

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** First result on swiftpieces.com. Pro is recorded in notes, not as a hit for this site. */
export function scoreGoogle(hits: Hit[], file: PromptFile): Pick<TrackRow, "google_present" | "google_rank" | "google_url" | "notes"> {
  const host = hostOf(file.site);
  const index = hits.findIndex((hit) => hostOf(hit.url) === host);
  const otherAt = hits.findIndex((hit) => hostOf(hit.url) === file.otherSite);
  const notes = otherAt >= 0 ? `${file.otherSite} at ${otherAt + 1}` : "";
  if (index < 0) return { google_present: "no", google_rank: "", google_url: "", notes };
  return { google_present: "yes", google_rank: String(index + 1), google_url: hits[index].url, notes };
}

/**
 * A mention is the name or the host. A citation is a URL on swiftpieces.com itself; a link to
 * pro.swiftpieces.com is noted, not counted.
 */
export function scoreAnswer(text: string, file: PromptFile): Pick<TrackRow, "ai_mentioned" | "ai_citation" | "notes"> {
  const host = hostOf(file.site);
  const lower = text.toLowerCase();
  const mentioned = file.mention.some((needle) => lower.includes(needle.toLowerCase()));
  const urls = (text.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ""));
  const cited = urls.find((url) => hostOf(url) === host);
  const otherOnly = !cited && urls.some((url) => hostOf(url) === file.otherSite);
  return {
    ai_mentioned: mentioned ? "yes" : "no",
    ai_citation: cited ?? "",
    notes: otherOnly ? `cited ${file.otherSite} only` : "",
  };
}

async function googleHits(query: string): Promise<Hit[]> {
  const serp = process.env.SERPAPI_KEY;
  if (serp) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", serp);
    url.searchParams.set("num", "10");
    const data = await fetch(url).then((res) => res.json()) as { organic_results?: { link?: string; title?: string }[] };
    return (data.organic_results ?? []).flatMap((item) => (item.link ? [{ url: item.link, title: item.title }] : []));
  }
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  const data = await fetch(url).then((res) => res.json()) as { items?: { link?: string; title?: string }[] };
  return (data.items ?? []).flatMap((item) => (item.link ? [{ url: item.link, title: item.title }] : []));
}

async function ask(engine: "openai" | "perplexity", prompt: string): Promise<string> {
  if (engine === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || "sonar",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`perplexity ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function engines(): ("openai" | "perplexity")[] {
  const list: ("openai" | "perplexity")[] = [];
  if (process.env.OPENAI_API_KEY) list.push("openai");
  if (process.env.PERPLEXITY_API_KEY) list.push("perplexity");
  return list;
}

function hasGoogle(): boolean {
  return Boolean(process.env.SERPAPI_KEY || (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX));
}

export async function collect(file: PromptFile, date: string): Promise<{ rows: TrackRow[]; mode: "api" | "manual" }> {
  const google = hasGoogle();
  const ai = engines();
  if (!google && !ai.length) return { rows: blankRows(file, date), mode: "manual" };
  const rows: TrackRow[] = [];
  for (const question of file.questions) {
    for (const prompt of question.google) {
      const row = blankRows({ ...file, questions: [{ ...question, google: [prompt], ai: [] }] }, date)[0];
      if (!google) {
        row.notes = "no google key";
        rows.push(row);
        continue;
      }
      try {
        Object.assign(row, scoreGoogle(await googleHits(prompt), file));
      } catch (error) {
        row.google_present = "";
        row.notes = `request failed: ${error instanceof Error ? error.message : "error"}`;
      }
      rows.push(row);
    }
    const targets = ai.length ? ai : ["" as const];
    for (const prompt of question.ai) {
      for (const engine of targets) {
        const row = blankRows({ ...file, questions: [{ ...question, google: [], ai: [prompt] }] }, date)[0];
        if (!engine) {
          row.notes = "no ai key";
          rows.push(row);
          continue;
        }
        row.engine = engine;
        try {
          Object.assign(row, scoreAnswer(await ask(engine, prompt), file));
        } catch (error) {
          row.ai_mentioned = "";
          row.notes = `request failed: ${error instanceof Error ? error.message : "error"}`;
        }
        rows.push(row);
      }
    }
  }
  return { rows, mode: "api" };
}

function checklist(rows: TrackRow[]): string {
  const lines = [
    "# AEO checklist",
    "",
    "Fill google_present, google_rank and google_url from a Google search.",
    "Fill ai_mentioned and ai_citation from ChatGPT, Perplexity, Claude, Gemini or an AI Overview.",
    "Leave a cell blank when you did not check it. Do not invent a rank or a citation.",
    "present/mentioned: yes or no. rank: 1 is the first result. citation: the swiftpieces.com URL you saw, or blank.",
    "",
    ...rows.map((row) => `- [${row.channel}] ${row.question_id}: ${row.prompt}`),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const file = loadPrompts();
  const { rows, mode } = await collect(file, date);
  const dir = join(HERE, "out");
  mkdirSync(dir, { recursive: true });
  const stem = join(dir, date);
  writeFileSync(`${stem}.csv`, toCsv(rows));
  writeFileSync(`${stem}.json`, JSON.stringify({ date, mode, rows }, null, 2) + "\n");
  writeFileSync(`${stem}.checklist.md`, checklist(rows));
  process.stdout.write(`${mode === "manual" ? "No API keys. Checklist only." : "Recorded API results."}\n${checklist(rows)}\nWrote ${stem}.csv\n`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) main();
