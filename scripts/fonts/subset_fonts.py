#!/usr/bin/env python3
"""Cut the site's web fonts down to what the site uses, as a preloaded core and an on-demand extended file.

Run by hand. Nothing here is part of the build: the output is committed, and the build only serves it.

    python3 -m venv .venv-fonts
    .venv-fonts/bin/pip install -r scripts/fonts/requirements.txt
    .venv-fonts/bin/python scripts/fonts/subset_fonts.py           # regenerate and verify
    .venv-fonts/bin/python scripts/fonts/subset_fonts.py --check   # verify only; exits 1 if the output is stale

Everything it needs is in scripts/fonts/fonts.json. For every face it:

1. downloads the source font from google/fonts at a pinned commit (cached in scripts/fonts/.cache, checked
   against a sha256), and reads the family's OFL.txt for Reserved Font Names;
2. keeps each variable axis at its `axes` range and pins the axes Google pinned (opsz). The ranges are the
   source's full ranges on purpose: narrowing one (say Figtree's wght to the 400-800 the site declares)
   saves about 2% but rescales the variation deltas, which are stored as integers, so outlines and advances
   move by up to 2 font units and antialiasing changed on every page in the pixel diff. Pins go through
   HarfBuzz's instancer, the tool Google Fonts uses, so a pinned file matches what Google served exactly;
3. keeps ASCII, Latin-1, Latin Extended-A and every other character found in the scanned source folders, but
   never a character the font did not already draw on the site (`coverage`, the codepoints the old
   next/font/google files held inside their unicode-range);
4. keeps only the OpenType features browsers turn on by default for English text plus the ones the site's CSS
   turns on (`features`), and drops hinting (Google already served these unhinted; `gasp` stays);
5. splits the result into a core (the `core` set: ASCII and the punctuation most pages use) and an extended
   file holding the rest, each with a unicode-range listing exactly the characters it contains. A browser
   shapes each file's run separately, so a word split across the two loses the kerning at the seam: any
   character that appears inside a word of the content and kerns there moves into the core instead;
6. checks the files: cmap, outlines and advances against the source at every declared weight, kerning and
   ligatures through HarfBuzz, names, hinting; then writes the woff2 files, the CSS and the preload manifest.

Rerun it when:
- content starts using a character outside ASCII, Latin-1 and Latin Extended-A that one of these fonts covers
  (an arrow, a currency sign, a Greek letter in Inter...). Until then it renders in the fallback font;
- a page uses a weight outside a family's `axes` range, or turns on another OpenType feature
  (font-variant-*, font-feature-settings) for one of these families;
- the core set, a source font or anything else in fonts.json changes.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont, woff2
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / ".cache"
RAW = "https://raw.githubusercontent.com/google/fonts/{commit}/{path}"

# Features a browser applies to English text without being asked (HarfBuzz's defaults for Latin).
DEFAULT_ON = {"abvm", "blwm", "calt", "ccmp", "clig", "curs", "dist", "kern", "liga", "locl", "mark", "mkmk", "rlig", "rvrn"}
# Name records kept: family, style, IDs, version, PostScript name, plus the copyright and OFL notice the licence asks for.
NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14]
RENAMED_IDS = {1, 3, 4, 6, 16, 17, 18, 21, 22, 25}


def fail(msg: str) -> None:
    sys.exit(f"subset_fonts: {msg}")


# ── Unicode sets ─────────────────────────────────────────────────────────────────────────────────

def parse_ranges(spec: str) -> set[int]:
    out: set[int] = set()
    for part in filter(None, (p.strip() for p in spec.split(","))):
        part = part.upper().removeprefix("U+")
        if "?" in part:
            lo, hi = int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)
        elif "-" in part:
            lo, hi = (int(x, 16) for x in part.split("-"))
        else:
            lo = hi = int(part, 16)
        out.update(range(lo, hi + 1))
    return out


def format_ranges(cps: set[int]) -> str:
    cps_sorted, out, i = sorted(cps), [], 0
    while i < len(cps_sorted):
        j = i
        while j + 1 < len(cps_sorted) and cps_sorted[j + 1] == cps_sorted[j] + 1:
            j += 1
        out.append(f"U+{cps_sorted[i]:X}" if i == j else f"U+{cps_sorted[i]:X}-{cps_sorted[j]:X}")
        i = j + 1
    return ",".join(out)


def scan_text(cfg: dict) -> tuple[set[int], list[str]]:
    """Every character in the scanned source folders, and the text itself for the shaping check."""
    exts = tuple(cfg["scan"]["extensions"])
    skip = set(cfg["scan"].get("skipDirs", []))
    chars: set[int] = set()
    texts: list[str] = []
    for d in cfg["scan"]["dirs"]:
        for dirpath, dirnames, filenames in os.walk(ROOT / d):
            dirnames[:] = [n for n in dirnames if n not in skip and not n.startswith(".")]
            for name in filenames:
                if not name.endswith(exts):
                    continue
                try:
                    text = (Path(dirpath) / name).read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
                texts.append(text)
                chars.update(ord(c) for c in text if ord(c) >= 0x20 and c not in "\x7f")
    return chars, texts


# ── Sources ──────────────────────────────────────────────────────────────────────────────────────

def fetch(commit: str, path: str, sha256: str | None = None) -> bytes:
    CACHE.mkdir(exist_ok=True)
    local = CACHE / f"{commit[:12]}-{path.replace('/', '_')}"
    if local.exists():
        data = local.read_bytes()
    else:
        url = RAW.format(commit=commit, path=urllib.request.quote(path))
        print(f"  downloading {path}")
        with urllib.request.urlopen(url) as r:
            data = r.read()
        local.write_bytes(data)
    if sha256 and hashlib.sha256(data).hexdigest() != sha256:
        fail(f"{path}: sha256 mismatch (expected {sha256}). Check the source and update fonts.json.")
    return data


def reserved_names(ofl: str) -> list[str]:
    m = re.search(r"with Reserved Font Names? ([^.]*)\.", ofl)
    return re.findall(r'"([^"]+)"', m.group(1)) if m else []


# ── Font work ────────────────────────────────────────────────────────────────────────────────────

def load(data: bytes) -> TTFont:
    font = TTFont(io.BytesIO(data), recalcTimestamp=False)
    return font


def instance(data: bytes, face: dict) -> TTFont:
    """Limit each axis to the configured range; pin the axes Google pins. Every axis must be configured.

    Pins go through HarfBuzz's instancer with IUP delta optimization, the way Google Fonts makes its pinned
    files: the result matches the outlines next/font/google served exactly, where fontTools' instancer
    rounds the remaining deltas differently and moved some points by a fraction of a unit."""
    font = load(data)
    if "fvar" not in font:
        return font
    pins = face.get("pin", {})
    limits = {}
    for axis in font["fvar"].axes:
        tag = axis.axisTag
        if tag in pins:
            continue
        if tag not in face.get("axes", {}):
            fail(f"{face['slug']}: axis {tag} has no range or pin in fonts.json")
        lo, hi = face["axes"][tag]
        if (lo, hi) != (axis.minValue, axis.maxValue):
            limits[tag] = lo if lo == hi else (lo, hi)
    if pins:
        try:
            import uharfbuzz as hb
        except ImportError:
            fail(f"{face['slug']}: pinning {', '.join(pins)} needs uharfbuzz (pip install -r scripts/fonts/requirements.txt)")
        hb_face = hb.Face(data)
        inp = hb.SubsetInput()
        for kind in ("UNICODE", "LAYOUT_FEATURE_TAG", "LAYOUT_SCRIPT_TAG", "NAME_ID", "NAME_LANG_ID"):
            keep_all = inp.sets(getattr(hb.SubsetInputSets, kind))
            keep_all.clear()  # some start with HarfBuzz's defaults; empty and inverted means everything
            keep_all.invert()
        inp.sets(hb.SubsetInputSets.DROP_TABLE_TAG).clear()
        inp.sets(hb.SubsetInputSets.GLYPH_INDEX).add_range(0, hb_face.glyph_count - 1)
        for flag in ("OPTIMIZE_IUP_DELTAS", "RETAIN_GIDS", "NOTDEF_OUTLINE", "GLYPH_NAMES", "NAME_LEGACY",
                     "NO_PRUNE_UNICODE_RANGES", "PASSTHROUGH_UNRECOGNIZED"):
            inp.flags |= getattr(hb.SubsetFlags, flag)
        for tag, value in pins.items():
            if not inp.pin_axis_location(hb_face, tag, value):
                fail(f"{face['slug']}: could not pin {tag} at {value}")
        font = load(hb.subset(hb_face, inp).blob.data)
    return instantiateVariableFont(font, limits, inplace=False, updateFontNames=False) if limits else font


def at(font: TTFont, location: dict) -> TTFont:
    """A static copy at one location (for checks only)."""
    if "fvar" not in font:
        return font
    tags = {a.axisTag for a in font["fvar"].axes}
    limits = {k: v for k, v in location.items() if k in tags}
    # An empty location is not a no-op for the instancer (it re-encodes the deltas), so skip it.
    return instantiateVariableFont(font, limits, inplace=False) if limits else font


def default_features(font: TTFont, extra: list[str]) -> list[str]:
    """Features in the default language system of DFLT/latn (what English text gets) that browsers apply
    by default or the site's CSS turns on."""
    tags: set[str] = set()
    for table in ("GSUB", "GPOS"):
        if table not in font or not font[table].table.ScriptList:
            continue
        t = font[table].table
        records = t.FeatureList.FeatureRecord
        for sr in t.ScriptList.ScriptRecord:
            if sr.ScriptTag not in ("DFLT", "latn"):
                continue
            systems = [sr.Script.DefaultLangSys] + [ls.LangSys for ls in sr.Script.LangSysRecord if ls.LangSysTag == "ENG "]
            for ls in filter(None, systems):
                idx = list(ls.FeatureIndex) + ([ls.ReqFeatureIndex] if ls.ReqFeatureIndex != 0xFFFF else [])
                tags.update(records[i].FeatureTag for i in idx)
    return sorted(t for t in tags if t in DEFAULT_ON or t in extra)


def rename(font: TTFont, reserved: list[str], new: str) -> None:
    """OFL: a modified font may not use a Reserved Font Name. Replace each one in the name records that name the font."""
    ps_new = new.replace(" ", "")
    for rec in font["name"].names:
        if rec.nameID not in RENAMED_IDS:
            continue
        s = rec.toUnicode()
        for rfn in reserved:
            s = s.replace(rfn, new).replace(rfn.replace(" ", ""), ps_new)
        rec.string = s


def cut(src: TTFont, unicodes: set[int], features: list[str], reserved: list[str], internal_name: str | None) -> bytes:
    buf = io.BytesIO()
    src.save(buf)
    buf.seek(0)
    font = TTFont(buf, recalcTimestamp=False)
    opts = subset.Options()
    opts.layout_features = features
    opts.layout_scripts = ["*"]
    opts.hinting = False
    opts.drop_tables += ["STAT", "DSIG", "meta", "hdmx", "VDMX", "LTSH"]
    opts.name_IDs = NAME_IDS
    opts.name_languages = [0x0409]
    opts.glyph_names = False
    opts.notdef_outline = False
    opts.recalc_timestamp = False
    opts.prune_unicode_ranges = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(unicodes))
    s.subset(font)
    if reserved and internal_name:
        rename(font, reserved, internal_name)
    ttf = io.BytesIO()
    font.save(ttf)
    ttf.seek(0)
    out = io.BytesIO()
    woff2.compress(ttf, out, transform_tables={"glyf", "loca", "hmtx"})
    return out.getvalue()


# ── Checks ───────────────────────────────────────────────────────────────────────────────────────

def coords(rec: list) -> list[float]:
    return [c for _, args in rec for a in args if isinstance(a, tuple) for c in a]


def check_outlines(ref: TTFont, out: TTFont, cps: set[int], location: dict) -> tuple[float, float]:
    """Max outline and advance difference, in font units, between the source and the cut file at one location."""
    r, o = at(ref, location), at(out, location)
    rc, oc = r.getBestCmap(), o.getBestCmap()
    rg, og = r.getGlyphSet(), o.getGlyphSet()
    worst_pt = worst_adv = 0.0
    for cp in cps:
        pr, po = RecordingPen(), RecordingPen()
        rg[rc[cp]].draw(pr)
        og[oc[cp]].draw(po)
        a, b = coords(pr.value), coords(po.value)
        if len(a) != len(b) or [op for op, _ in pr.value] != [op for op, _ in po.value]:
            return float("inf"), float("inf")
        worst_pt = max([worst_pt] + [abs(x - y) for x, y in zip(a, b)])
        worst_adv = max(worst_adv, abs(rg[rc[cp]].width - og[oc[cp]].width))
    return worst_pt, worst_adv


class Shaper:
    def __init__(self, data: bytes, location: dict):
        import uharfbuzz as hb
        self.hb = hb
        if data[:4] == b"wOF2":  # HarfBuzz reads TrueType, not woff2
            buf, ttf = io.BytesIO(), TTFont(io.BytesIO(data))
            ttf.flavor = None
            ttf.save(buf)
            data = buf.getvalue()
        self.font = hb.Font(hb.Face(data))
        if location:
            try:
                self.font.set_variations({k: float(v) for k, v in location.items()})
            except Exception:
                pass

    def run(self, text: str, features: dict | None = None) -> list[tuple[int, int, int]]:
        hb = self.hb
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        buf.language = "en"
        hb.shape(self.font, buf, features or {})
        return [(p.x_advance, p.x_offset, p.y_offset) for p in buf.glyph_positions]


def same(a: list[tuple], b: list[tuple], tol: int) -> bool:
    return len(a) == len(b) and all(abs(x - y) <= tol for p, q in zip(a, b) for x, y in zip(p, q))


def words(texts: list[str], allowed: set[int]) -> set[str]:
    """Runs of characters the font keeps, as they appear in the source: the real contexts kerning and ligatures see."""
    found: set[str] = set()
    for t in texts:
        for w in re.findall(r"[^\s<>{}\"`]+", t):
            w = "".join(c for c in w if ord(c) in allowed)
            if 1 < len(w) <= 40:
                found.add(w)
    return found


def shape_check(ref_data: bytes, files: dict[str, bytes], parts: dict[str, set[int]], location: dict, pins: dict,
                features: list[str], corpus: set[str], tol: int) -> tuple[int, list[str]]:
    """Shape every pair inside each file and every corpus word, with the source and with the cut files, the
    way a browser does: one run per file. Returns (differences inside a file, words whose shaping changes
    only because they cross from the core into the extended file)."""
    ref = Shaper(ref_data, {**pins, **location})
    cut_shapers = {k: Shaper(v, location) for k, v in files.items()}
    inside = 0
    for part, cps in parts.items():
        # A soft hyphen draws nothing unless the line breaks there (then the browser draws a hyphen), and
        # HarfBuzz keeps or drops its empty glyph depending on the font around it: leave it out of the pairs.
        chars = [chr(c) for c in sorted(cps) if c != 0xAD]
        for a in chars:
            for b in chars:
                if not same(ref.run(a + b), cut_shapers[part].run(a + b), tol):
                    inside += 1
        if "tnum" in features:
            digits = "".join(c for c in "0123456789.,:" if ord(c) in cps)
            if digits and not same(ref.run(digits, {"tnum": True}), cut_shapers[part].run(digits, {"tnum": True}), tol):
                inside += 1
    owner = {cp: part for part, cps in parts.items() for cp in cps}
    crossing: list[str] = []
    for w in corpus:
        runs, cur = [], None
        for ch in w:
            p = owner[ord(ch)]
            if p != cur:
                runs.append([p, ""])
                cur = p
            runs[-1][1] += ch
        got = [g for p, s in runs for g in cut_shapers[p].run(s)]
        if not same(got, ref.run(w), tol):
            if len(runs) == 1:
                inside += 1
            else:
                crossing.append(w)
    return inside, sorted(crossing)


def crossing_words(ref_data: bytes, files: dict[str, bytes], parts: dict[str, set[int]], weights: list[int],
                   variable: bool, pins: dict, corpus: set[str], tol: int) -> set[str]:
    """Corpus words whose shaping changes because they run from the core into the extended file. A browser
    shapes each file's run on its own, so a kern or ligature across the seam is lost and the rest of the
    line shifts (seen as "Inés Marlow" in the pixel diff)."""
    owner = {cp: part for part, cps in parts.items() for cp in cps}
    mixed = [w for w in corpus if len({owner[ord(c)] for c in w}) > 1]
    found: set[str] = set()
    for wt in weights:
        loc = {"wght": wt} if variable else {}
        ref = Shaper(ref_data, {**pins, **loc})
        cuts = {k: Shaper(v, loc) for k, v in files.items()}
        for w in mixed:
            runs, cur = [], None
            for ch in w:
                if owner[ord(ch)] != cur:
                    cur = owner[ord(ch)]
                    runs.append([cur, ""])
                runs[-1][1] += ch
            if not same([g for p, t in runs for g in cuts[p].run(t)], ref.run(w), tol):
                found.add(w)
    return found


# ── Main ─────────────────────────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify the committed output is current; write nothing")
    ap.add_argument("--config", default=str(HERE / "fonts.json"))
    args = ap.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    commit = cfg["googleFontsCommit"]

    scanned, texts = scan_text(cfg)
    always = parse_ranges(cfg["alwaysKeep"])
    core_set = parse_ranges(cfg["core"])
    wanted = always | scanned | core_set
    print(f"scanned {len(texts)} files: {len(scanned)} distinct characters")

    out_dir = ROOT / cfg["outDir"]
    written: dict[str, bytes] = {}
    css: dict[str, list[str]] = {}
    preloads: list[str] = []
    report: list[str] = []
    problems: list[str] = []

    for fam in cfg["families"]:
        family = fam["family"]
        rules = css.setdefault(fam["css"], [])
        fb = fam["fallback"]
        fb_rule = (f'@font-face {{ font-family: "{fb["family"]}"; src: local("{fb["local"]}"); '
                   f'ascent-override: {fb["ascent"]}; descent-override: {fb["descent"]}; '
                   f'line-gap-override: {fb["lineGap"]}; size-adjust: {fb["sizeAdjust"]}; }}')
        face_rules: list[str] = []
        for face in fam["faces"]:
            slug = face["slug"]
            ofl = fetch(commit, face["license"]).decode("utf-8", "replace")
            reserved = reserved_names(ofl)
            if reserved and not fam.get("internalName"):
                fail(f"{slug}: OFL Reserved Font Names {reserved}; set internalName so the cut font is renamed")
            src_data = fetch(commit, face["source"], face["sha256"])
            src = load(src_data)
            limited = instance(src_data, face)
            coverage = parse_ranges(face["coverage"])
            cmap = set(limited.getBestCmap())
            keep = cmap & coverage & wanted
            parts = {"core": keep & core_set, "ext": keep - core_set}
            features = default_features(limited, fam.get("features", []))
            pins = face.get("pin", {})
            corpus = words(texts, keep)
            # Pinning an axis (as Google does with opsz) or narrowing one rescales the variation deltas, which
            # the font stores as integers, and the checks compare against fontTools' own instance: allow that rounding (one unit on an outline point or advance, two on
            # an advance plus a kern) and nothing more.
            limited_axes = bool(pins) or "fvar" in src and any(
                (a.minValue, a.maxValue) != tuple(face.get("axes", {}).get(a.axisTag, (a.minValue, a.maxValue)))
                for a in src["fvar"].axes if a.axisTag not in pins)
            tol = 2 if limited_axes else 0
            # A character that sits inside a word next to core characters and kerns (or ligates) with them
            # moves into the core, so no word in the content is split across the two files.
            moved: set[int] = set()
            try:
                while parts["ext"]:
                    trial = {k: cut(limited, v, features, [], None) for k, v in parts.items() if v}
                    seam = crossing_words(src_data, trial, {k: parts[k] for k in trial}, face["weights"],
                                          "fvar" in limited, pins, corpus, tol)
                    add = {ord(c) for w in seam for c in w} & parts["ext"]
                    if not add:
                        break
                    parts = {"core": parts["core"] | add, "ext": parts["ext"] - add}
                    moved |= add
            except ImportError:
                print("  (uharfbuzz not installed: could not check words that cross into the extended file)")
            if moved:
                report.append(f"  {slug}: moved into the core so words keep their kerning: {''.join(chr(c) for c in sorted(moved))}")
            files: dict[str, bytes] = {}
            for part, cps in parts.items():
                if not cps:
                    continue
                data = cut(limited, cps, features, reserved, fam.get("internalName"))
                name = f"{slug}-{part}.{hashlib.sha256(data).hexdigest()[:10]}.woff2"
                files[part] = data
                written[name] = data
                f = TTFont(io.BytesIO(data))
                got = set(f.getBestCmap())
                # The subsetter can map an extra character to a glyph it kept anyway (a composite's component);
                # that is fine while the font drew that character before. The unicode-range follows the cmap.
                if cps - got or got - cps - coverage:
                    problems.append(f"{name}: cmap lacks {format_ranges(cps - got) or '-'}, adds {format_ranges(got - cps - coverage) or '-'}")
                hinting = [t for t in ("fpgm", "prep", "cvt ", "cvar", "hdmx", "VDMX", "LTSH") if t in f]
                if hinting:
                    problems.append(f"{name}: hinting tables left: {hinting}")
                if reserved:
                    left = [r.toUnicode() for r in f["name"].names if r.nameID in RENAMED_IDS and any(x in r.toUnicode() for x in reserved)]
                    if left:
                        problems.append(f"{name}: Reserved Font Name still in names: {left}")
                axes = {a.axisTag: (a.minValue, a.maxValue) for a in f["fvar"].axes} if "fvar" in f else {}
                feats = sorted({fr.FeatureTag for t in ("GSUB", "GPOS") if t in f and f[t].table.FeatureList for fr in f[t].table.FeatureList.FeatureRecord})
                report.append(f"  {name:44} {len(data):>7,} B  {f['maxp'].numGlyphs:>4} glyphs  axes {axes or '-'}  features {','.join(feats) or '-'}  gasp {'yes' if 'gasp' in f else 'no'}")
                for w in face["weights"]:
                    face_rules.append((w, part, face["style"], name, format_ranges(got)))
                if part == "core" and fam.get("preload"):
                    preloads.append(cfg["urlPrefix"] + name)
            # Checks against the source at every weight the CSS declares.
            for w in face["weights"]:
                loc = {"wght": w} if "fvar" in limited else {}
                for part, data in files.items():
                    # A pinned face is checked against the pinned instance: fontTools' instancer rounds the
                    # pin differently (up to 7 units on DM Sans at 300) from HarfBuzz and Google.
                    pt, adv = check_outlines(limited if pins else src, TTFont(io.BytesIO(data)), parts[part], loc)
                    if max(pt, adv) > (0 if pins else tol):
                        problems.append(f"{slug}-{part} @{w}: outlines differ from the source by {pt} units, advances by {adv}")
                try:
                    inside, crossing = shape_check(src_data, files, {k: parts[k] for k in files}, loc, pins, features, corpus, tol)
                except ImportError:
                    print("  (uharfbuzz not installed: skipped the shaping check)")
                    break
                if inside:
                    problems.append(f"{slug} @{w}: {inside} shaping differences inside one file")
                if crossing:
                    problems.append(f"{slug} @{w}: words still lose a kern or ligature across core/extended: {crossing[:8]}")
        # Same order next/font used: per weight, the extended face before the core face.
        for w, part, style, name, ur in sorted(face_rules, key=lambda r: (r[2], r[0], r[1] != "ext")):
            rules.append(f'@font-face {{ font-family: "{family}"; font-style: {style}; font-weight: {w}; font-display: swap; '
                         f'src: url("{cfg["urlPrefix"]}{name}") format("woff2"); unicode-range: {ur}; }}')
        rules.append(fb_rule)
    for path, group in cfg["css"].items():
        lines = css.setdefault(path, [])
        for selector, decls in group.get("vars", {}).items():
            body = " ".join(f'{prop}: "{fam_name}", "{fam_name} Fallback";' for prop, fam_name in decls.items())
            lines.append(f"{selector} {{ {body} }}")

    header = "/* Generated by scripts/fonts/subset_fonts.py from scripts/fonts/fonts.json. Do not edit; rerun the script. */\n"
    outputs: dict[Path, bytes] = {ROOT / p: (header + "\n".join(lines) + "\n").encode() for p, lines in css.items()}
    manifest = ("// Generated by scripts/fonts/subset_fonts.py. Do not edit; rerun the script.\n"
                "/** Core font files every page preloads, as next/font did for the latin subset. */\n"
                f"export const fontPreloads = {json.dumps(preloads)} as const;\n")
    outputs[ROOT / cfg["manifest"]] = manifest.encode()
    outputs.update({out_dir / n: d for n, d in written.items()})

    print("\n".join(report))
    if problems:
        print("\n".join("PROBLEM " + p for p in problems))
        fail(f"{len(problems)} problem(s); nothing written")

    stale = [p for p in out_dir.glob("*.woff2") if p.name not in written] if out_dir.exists() else []
    changed = [p for p, d in outputs.items() if not p.exists() or p.read_bytes() != d]
    if args.check:
        if changed or stale:
            fail("output is stale: " + ", ".join(str(p.relative_to(ROOT)) for p in changed + stale))
        print("output is current")
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in stale:
        p.unlink()
    for p, d in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(d)
    print(f"wrote {len(changed)} file(s), removed {len(stale)}")


if __name__ == "__main__":
    main()
