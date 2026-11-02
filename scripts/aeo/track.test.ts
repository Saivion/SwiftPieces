import assert from "node:assert/strict";
import { describe, it } from "node:test";
import docs from "../../registry/__registry__/docs.json";
import { blankRows, loadPrompts, scoreAnswer, scoreGoogle, toCsv, type PromptFile } from "./track";

const file: PromptFile = {
  site: "https://swiftpieces.com",
  mention: ["swiftpieces.com", "SwiftPieces"],
  otherSite: "pro.swiftpieces.com",
  questions: [{ id: "toast", buyerQuestion: "Toast?", target: "/docs/components/sheets/toast", google: ["swiftui toast"], ai: ["Which toast?"] }],
};

describe("aeo tracker", () => {
  it("loads the committed prompts and keeps google and ai rows apart, all blank", () => {
    const prompts = loadPrompts();
    assert.ok(prompts.questions.length >= 10);
    const rows = blankRows(prompts, "2026-11-01");
    assert.ok(rows.some((row) => row.channel === "google" && row.google_present === ""));
    assert.ok(rows.some((row) => row.channel === "ai" && row.ai_mentioned === ""));
    assert.ok(rows.every((row) => row.google_rank === "" && row.ai_citation === ""));
    assert.match(toCsv(rows), /google_present,google_rank,google_url,ai_mentioned,ai_citation/);
    assert.doesNotMatch(toCsv(rows), /,"yes",/);
  });

  it("points every question at a page that exists", () => {
    const docPages = new Set(docs.map((page) => page.url));
    for (const q of loadPrompts().questions) {
      const ok = q.target === "/" || q.target.startsWith("/components/") || docPages.has(q.target);
      assert.ok(ok, `${q.id}: ${q.target}`);
    }
  });

  it("scores swiftpieces.com apart from Pro and from a miss", () => {
    const hit = scoreGoogle([{ url: "https://pro.swiftpieces.com/library" }, { url: "https://www.swiftpieces.com/docs/components/sheets/toast" }], file);
    assert.equal(hit.google_present, "yes");
    assert.equal(hit.google_rank, "2");
    assert.match(hit.google_url, /swiftpieces\.com\/docs/);
    assert.match(hit.notes, /pro\.swiftpieces\.com at 1/);

    const miss = scoreGoogle([{ url: "https://example.com" }], file);
    assert.equal(miss.google_present, "no");
    assert.equal(miss.google_rank, "");

    const cited = scoreAnswer("Try SwiftPieces: https://swiftpieces.com/docs/components/sheets/toast.", file);
    assert.equal(cited.ai_mentioned, "yes");
    assert.equal(cited.ai_citation, "https://swiftpieces.com/docs/components/sheets/toast");

    const proOnly = scoreAnswer("SwiftPieces Pro sells screens at https://pro.swiftpieces.com/pro", file);
    assert.equal(proOnly.ai_mentioned, "yes");
    assert.equal(proOnly.ai_citation, "");
    assert.match(proOnly.notes, /pro\.swiftpieces\.com only/);

    assert.equal(scoreAnswer("Use a ZStack.", file).ai_mentioned, "no");
  });
});
