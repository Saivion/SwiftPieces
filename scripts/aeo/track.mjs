/**
 * Records Google presence and AI mention/citation for the buyer prompts.
 * Blank cells are unmeasured. Errors stay in notes and are not stored as "no".
 * Usage: node scripts/aeo/track.mjs [--manual] [--engine name] [--id prompt-id] [--out dir]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROMPTS_PATH = join(dirname(fileURLToPath(import.meta.url)), "prompts.json");

const COLUMNS = [
  "date",
  "channel",
  "engine",
  "id",
  "buyer_question",
  "query",
  "target_url",
  "google_presence",
  "google_rank",
  "ai_mention",
  "ai_citation",
  "evidence",
  "notes",
];

function args(argv) {
  const out = { manual: false, engine: "all", id: "", outDir: join(dirname(fileURLToPath(import.meta.url)), "results") };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--manual") out.manual = true;
    else if (flag === "--engine") out.engine = argv[++i] ?? "all";
    else if (flag === "--id") out.id = argv[++i] ?? "";
    else if (flag === "--out") out.outDir = argv[++i] ?? out.outDir;
    else throw new Error(`Unknown argument ${flag}`);
  }
  return out;
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function judgeText(text, siteHost) {
  const lower = text.toLowerCase();
  const mention = lower.includes("swiftpieces");
  const citation = lower.includes(siteHost);
  return {
    ai_mention: mention ? "yes" : "no",
    ai_citation: citation ? "yes" : "no",
  };
}

function judgeLinks(links, siteHost, paidHost) {
  const hosts = links.map(hostOf).filter(Boolean);
  const rank = hosts.findIndex((host) => host === siteHost);
  const paid = hosts.findIndex((host) => host === paidHost);
  const notes = paid >= 0 ? `pro.swiftpieces.com at rank ${paid + 1}` : "";
  return {
    google_presence: rank >= 0 ? "yes" : "no",
    google_rank: rank >= 0 ? String(rank + 1) : "",
    evidence: links.slice(0, 10).join(" "),
    notes,
  };
}

async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 240)}`);
  return JSON.parse(text);
}

async function googleCustomSearch(query) {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", process.env.GOOGLE_API_KEY);
  url.searchParams.set("cx", process.env.GOOGLE_CSE_ID);
  url.searchParams.set("q", query);
  const data = await getJson(url);
  return (data.items ?? []).map((item) => item.link).filter(Boolean);
}

async function googleSerpApi(query) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", process.env.SERPAPI_KEY);
  const data = await getJson(url);
  return (data.organic_results ?? []).map((item) => item.link).filter(Boolean);
}

async function chatOpenAI(prompt) {
  const data = await getJson("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  return data.choices?.[0]?.message?.content ?? "";
}

async function chatPerplexity(prompt) {
  const data = await getJson("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || "sonar",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  return data.choices?.[0]?.message?.content ?? "";
}

async function chatAnthropic(prompt) {
  const data = await getJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  return (data.content ?? []).map((block) => block.text ?? "").join("\n");
}

async function chatGemini(prompt) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const data = await getJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("\n");
}

function engines(flags) {
  const googleReady = Boolean((process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) || process.env.SERPAPI_KEY);
  const list = [
    { name: "google", channel: "google", ready: googleReady, missing: "Set GOOGLE_API_KEY and GOOGLE_CSE_ID, or SERPAPI_KEY" },
    { name: "openai", channel: "ai", ready: Boolean(process.env.OPENAI_API_KEY), missing: "Set OPENAI_API_KEY" },
    { name: "perplexity", channel: "ai", ready: Boolean(process.env.PERPLEXITY_API_KEY), missing: "Set PERPLEXITY_API_KEY" },
    { name: "anthropic", channel: "ai", ready: Boolean(process.env.ANTHROPIC_API_KEY), missing: "Set ANTHROPIC_API_KEY" },
    { name: "gemini", channel: "ai", ready: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY), missing: "Set GEMINI_API_KEY" },
  ];
  if (flags.engine === "all") return list;
  const one = list.find((engine) => engine.name === flags.engine);
  if (!one) throw new Error(`Unknown engine ${flags.engine}`);
  return [one];
}

function blankRow(date, channel, engine, item, query, notes) {
  return {
    date,
    channel,
    engine,
    id: item.id,
    buyer_question: item.buyerQuestion,
    query,
    target_url: item.targetUrl,
    google_presence: "",
    google_rank: "",
    ai_mention: "",
    ai_citation: "",
    evidence: "",
    notes,
  };
}

async function measure(engine, item, prompts, date) {
  const query = engine.channel === "google" ? item.query : item.prompt;
  if (!engine.ready) return blankRow(date, engine.channel, engine.name, item, query, engine.missing);
  try {
    if (engine.name === "google") {
      const links = process.env.SERPAPI_KEY && !(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID)
        ? await googleSerpApi(item.query)
        : await googleCustomSearch(item.query);
      const judged = judgeLinks(links, prompts.siteHost, prompts.paidHost);
      return { ...blankRow(date, "google", "google", item, item.query, judged.notes), ...judged };
    }
    const prompt = item.prompt;
    const text = engine.name === "openai" ? await chatOpenAI(prompt)
      : engine.name === "perplexity" ? await chatPerplexity(prompt)
        : engine.name === "anthropic" ? await chatAnthropic(prompt)
          : await chatGemini(prompt);
    const judged = judgeText(text, prompts.siteHost);
    return {
      ...blankRow(date, "ai", engine.name, item, prompt, ""),
      ...judged,
      evidence: text.replaceAll(/\s+/g, " ").slice(0, 500),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return blankRow(date, engine.channel, engine.name, item, query, `error: ${message}`);
  }
}

function writeTable(dir, rows) {
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const base = join(dir, stamp);
  const csv = [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
  writeFileSync(`${base}.csv`, csv);
  writeFileSync(`${base}.json`, `${JSON.stringify(rows, null, 2)}\n`);
  return base;
}

const flags = args(process.argv.slice(2));
const prompts = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));
const date = new Date().toISOString().slice(0, 10);
const rows = [];

if (flags.manual) {
  const google = prompts.google.filter((item) => !flags.id || item.id === flags.id);
  const ai = prompts.ai.filter((item) => !flags.id || item.id === flags.id);
  for (const item of google) rows.push(blankRow(date, "google", "manual", item, item.query, "manual checklist, not a measured result"));
  for (const item of ai) rows.push(blankRow(date, "ai", "manual", item, item.prompt, "manual checklist, not a measured result"));
} else {
  for (const engine of engines(flags)) {
    const items = (engine.channel === "google" ? prompts.google : prompts.ai).filter((item) => !flags.id || item.id === flags.id);
    for (const item of items) rows.push(await measure(engine, item, prompts, date));
  }
}

if (!rows.length) throw new Error("No prompts matched.");
const base = writeTable(flags.outDir, rows);
console.log(`Wrote ${rows.length} rows to ${base}.csv`);
console.log(COLUMNS.join("\t"));
for (const row of rows) {
  console.log([row.channel, row.engine, row.id, row.google_presence, row.google_rank, row.ai_mention, row.ai_citation, row.notes].join("\t"));
}
