# Answer visibility tracker

Records whether SwiftPieces shows up in Google and in AI answers for the buyer questions in `docs/aeo/buyer-question-map.md`.

Google presence and AI mention or citation are separate columns. A blank cell means that channel was not measured. An error is written in `notes` and does not become a "no".

Results are written under `scripts/aeo/results/` and gitignored. Do not commit them. A committed file would read like a published measurement.

## Commands

From the repo root:

```bash
node scripts/aeo/track.mjs --manual
node scripts/aeo/track.mjs
npx tsx scripts/aeo/write-lastmod.ts
```

`--manual` writes a checklist with empty measurement columns. Fill `google_presence`, `google_rank`, `ai_mention`, and `ai_citation` from a search you actually ran and a chat you actually opened. Use `yes` or `no` only after that.

With no flags, the script calls whatever APIs have keys and skips the rest. It still writes a row per prompt so the gap is visible.

`--engine google|openai|perplexity|anthropic|gemini` limits the run. `--id best-library` limits it to one buyer question.

`--out <dir>` chooses the folder. The default is `scripts/aeo/results`.

## Keys

Set these in the environment. None are required. None are read from the repo.

| Engine | Variables | What it calls |
| --- | --- | --- |
| Google | `GOOGLE_API_KEY` and `GOOGLE_CSE_ID`, or `SERPAPI_KEY` | Custom Search JSON API, or SerpAPI `engine=google` |
| OpenAI | `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4o-mini`) | Chat completions |
| Perplexity | `PERPLEXITY_API_KEY`, optional `PERPLEXITY_MODEL` (default `sonar`) | Chat completions |
| Anthropic | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`) | Messages API |
| Gemini | `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.0-flash`) | generateContent |

Google presence is `yes` when a result host is `swiftpieces.com`. `pro.swiftpieces.com` is noted and does not count as the free site. Rank is 1-based inside the results the API returned (usually the first page).

AI mention is `yes` when the answer text contains "SwiftPieces". AI citation is `yes` when it contains `swiftpieces.com`. A mention without a citation is a name-drop. Record both.

## Sitemap dates

`write-lastmod.ts` writes `registry/__registry__/lastmod.json` from git history. Dirty or untracked files get the current time. Re-run it after editing a buyer page and commit the JSON. `npm test` fails if the sitemap lists a path the file does not date.

Cloudflare's checkout is often a shallow clone, so this script is not part of `registry:build`. Generating dates there would stamp every page with the deploy commit.
