# AEO prompt checklist

Tracks whether swiftpieces.com shows up for the questions an iOS developer asks Google or an AI assistant before picking a SwiftUI component. Google rank and AI mentions are different measurements, so they go in different columns.

## Run

```bash
npm run aeo:track
```

Optional keys, in the environment, never in the repo:

- `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX`, or `SERPAPI_KEY`, for Google.
- `OPENAI_API_KEY` for one AI answer. `OPENAI_MODEL` overrides the model.
- `PERPLEXITY_API_KEY` for a second AI answer. `PERPLEXITY_MODEL` overrides the model.

With no keys the script writes `scripts/aeo/out/<date>.csv`, the same rows as JSON, and a checklist. Those files are gitignored. The result cells are blank. Blank means not checked.

## Fill by hand

Open the CSV. For each row:

| Column | Google row | AI row |
| --- | --- | --- |
| google_present | yes or no, for swiftpieces.com | leave blank |
| google_rank | 1 is the first organic result, blank if absent | leave blank |
| google_url | the swiftpieces.com URL you saw | leave blank |
| ai_mentioned | leave blank | yes or no, for SwiftPieces or swiftpieces.com |
| ai_citation | leave blank | the swiftpieces.com URL the answer cited, or blank |
| notes | anything odd, such as Pro ranking instead | the engine you asked: ChatGPT, Perplexity, Claude, Gemini, or an AI Overview |

Do not type a rank or a citation you did not see. A failed API call stays blank and says `request failed` in notes. That is not a "no".

## Questions

Questions live in `prompts.json`. Each has the page meant to answer it (`target`), Google queries and AI prompts as separate lists. When a question's target is weak, fix that page's copy and FAQ rather than adding a new URL. Add a question there, then rerun.
