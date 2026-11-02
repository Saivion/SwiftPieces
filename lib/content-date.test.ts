import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentDate, laterDate } from "./content-date";
import { changelog } from "./changelog";

describe("contentDate", () => {
  it("parses ISO days, changelog days and changelog months as UTC", () => {
    assert.equal(contentDate("2026-10-19")?.toISOString(), "2026-10-19T00:00:00.000Z");
    assert.equal(contentDate("Oct 19, 2026")?.toISOString(), "2026-10-19T00:00:00.000Z");
    assert.equal(contentDate("Sep 2026")?.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(contentDate("not a date"), null);
    assert.equal(contentDate("2026-13-01"), null);
  });

  it("reads every changelog date", () => {
    for (const entry of changelog) assert.ok(contentDate(entry.date), `${entry.slug}: ${entry.date}`);
  });

  it("picks the later instant", () => {
    const older = contentDate("2026-10-05")!;
    const newer = contentDate("2026-10-30")!;
    assert.equal(laterDate(older, newer), newer);
    assert.equal(laterDate(newer, older), newer);
  });
});
