#!/usr/bin/env python3
"""
Auto-updater for the Nancy Serrano-Wu crossword archive.

Scrapes Slate's author page for Nancy Serrano-Wu (the only venue she publishes
to on a recurring schedule) and merges any new puzzles into data.json.

Run locally:
    python3 scripts/update_data.py

Run by GitHub Actions on a daily schedule (see .github/workflows/update.yml).
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data.json"

SLATE_AUTHOR_PAGES = [
    "https://slate.com/author/nancy-serrano-wu",
    "https://slate.com/author/nancy-serrano-wu/2",
    "https://slate.com/author/nancy-serrano-wu/3",
    "https://slate.com/author/nancy-serrano-wu/4",
]

UA = "Mozilla/5.0 (compatible; NSWCrosswordArchive/1.0; +https://github.com/)"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


# Match Slate's daily-puzzle article URLs (absolute or root-relative)
ARTICLE_URL_RE = re.compile(
    r'(?:https://slate\.com)?(/(?:life|culture)/\d{4}/\d{2}/crossword-slate-daily-puzzle-[a-z0-9-]+\.html)',
    re.IGNORECASE,
)
# After we know an article URL, find the nearest 'Slate Crossword: <Title>' headline.
# Slate wraps headlines in <b>...</b> on the index page.
TITLE_NEAR_RE_TMPL = (
    r'href="(?:https://slate\.com)?{path}"'
    r'[^<]*(?:<[^>]+>[^<]*){{0,12}}?'
    r'<b[^>]*>\s*(?:Slate Crossword:\s*)?([^<]+?)\s*</b>'
)

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "april": 4, "may": 5,
    "jun": 6, "june": 6, "jul": 7, "july": 7, "aug": 8, "sep": 9,
    "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_date_from_url(url: str):
    """Pull the date from the URL slug: .../crossword-slate-daily-puzzle-april-30-2026.html"""
    m = re.search(
        r'/crossword-slate-daily-puzzle-([a-z]+)-(\d{1,2})-(\d{4})\.html',
        url, re.IGNORECASE,
    )
    if not m:
        return None
    mon, day, year = m.group(1).lower(), int(m.group(2)), int(m.group(3))
    if mon not in MONTHS:
        return None
    try:
        return datetime(year, MONTHS[mon], day)
    except ValueError:
        return None


def clean_title(raw: str) -> str:
    """Strip 'Slate Crossword: ' prefix and HTML entities, normalize whitespace."""
    t = re.sub(r'\s+', ' ', raw).strip()
    # Decode common entities
    t = (t.replace("&amp;", "&").replace("&#x27;", "'").replace("&quot;", '"')
           .replace("&#8217;", "'").replace("&#8220;", "\u201c")
           .replace("&#8221;", "\u201d").replace("&nbsp;", " "))
    t = re.sub(r'^Slate Crossword:\s*', '', t)
    return t.strip()


def discover_slate_puzzles():
    """Yield {date, title, url} for every Slate puzzle found across her author pages."""
    seen = set()
    for page_url in SLATE_AUTHOR_PAGES:
        try:
            print(f"  fetching {page_url}", file=sys.stderr)
            html = fetch(page_url)
        except (URLError, HTTPError) as e:
            print(f"  warn: failed to fetch {page_url}: {e}", file=sys.stderr)
            continue
        # 1) Collect every distinct article URL
        paths = []
        for m in ARTICLE_URL_RE.finditer(html):
            path = m.group(1)
            if path not in paths:
                paths.append(path)
        # 2) For each, find the nearest <b>...</b> headline
        for path in paths:
            full_url = "https://slate.com" + path
            if full_url in seen:
                continue
            seen.add(full_url)
            dt = parse_date_from_url(full_url)
            if not dt:
                continue
            title = None
            try:
                pat = re.compile(
                    TITLE_NEAR_RE_TMPL.format(path=re.escape(path)),
                    re.IGNORECASE | re.DOTALL,
                )
                tm = pat.search(html)
                if tm:
                    title = clean_title(tm.group(1))
            except re.error:
                pass
            if not title:
                # Fallback: derive a title from the URL slug
                slug = path.split("/")[-1].replace(".html", "")
                title = slug.replace("-", " ").title()
            yield {"url": full_url, "title": title, "date_obj": dt}
        time.sleep(1)  # be polite to Slate


def normalize_record(p):
    """Turn a raw discovered puzzle into a data.json record."""
    dt = p["date_obj"]
    title = p["title"]
    # Pull the trailing letter clue, e.g. "(10 Letters)"
    m = re.search(r'\(([^()]+)\)\s*$', title)
    letters_clue = m.group(1) if m and "letter" in m.group(1).lower() else None
    clean = re.sub(r'\s*\(([^()]+)\)\s*$', '', title).strip() if letters_clue else title
    return {
        "date": dt.strftime("%Y-%m-%d"),
        "date_display": dt.strftime("%b %d, %Y"),
        "day_of_week": dt.strftime("%A"),
        "year": dt.year,
        "month": dt.month,
        "venue": "Slate",
        "venue_short": "Slate",
        "title": clean,
        "full_title": title,
        "letters_clue": letters_clue,
        "url": p["url"],
        "co_constructor": None,
        "puzzle_type": "Daily",
    }


def recompute_stats(puzzles):
    venues, years, days = {}, {}, {}
    for r in puzzles:
        venues[r["venue"]] = venues.get(r["venue"], 0) + 1
        years[r["year"]] = years.get(r["year"], 0) + 1
        days[r["day_of_week"]] = days.get(r["day_of_week"], 0) + 1
    earliest = min(puzzles, key=lambda r: r["date"])
    latest = max(puzzles, key=lambda r: r["date"])
    return {
        "total": len(puzzles),
        "venues": venues,
        "years": years,
        "days": days,
        "first_date": earliest["date"],
        "first_date_display": earliest["date_display"],
        "first_venue": earliest["venue"],
        "latest_date": latest["date"],
        "latest_date_display": latest["date_display"],
        "latest_venue": latest["venue"],
        "latest_title": latest["title"],
        "latest_url": latest["url"],
    }


def main():
    print("Loading existing data...", file=sys.stderr)
    data = json.loads(DATA_FILE.read_text())
    existing_urls = {p["url"] for p in data["puzzles"] if p.get("url")}

    print("Discovering Slate puzzles...", file=sys.stderr)
    found = list(discover_slate_puzzles())
    print(f"  found {len(found)} candidate puzzles on Slate", file=sys.stderr)

    new_records = []
    for p in found:
        if p["url"] in existing_urls:
            continue
        new_records.append(normalize_record(p))

    if not new_records:
        print("No new puzzles. Updating timestamp only.", file=sys.stderr)
    else:
        print(f"Adding {len(new_records)} new puzzle(s):", file=sys.stderr)
        for r in new_records:
            print(f"  + {r['date']} | {r['venue']} | {r['title']}", file=sys.stderr)
        data["puzzles"].extend(new_records)

    # Sort newest-first and recompute stats
    data["puzzles"].sort(key=lambda r: r["date"], reverse=True)
    data["stats"] = recompute_stats(data["puzzles"])
    data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    DATA_FILE.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {DATA_FILE} ({data['stats']['total']} puzzles total).", file=sys.stderr)

    # Emit a flag GitHub Actions can read to decide whether to commit
    if new_records:
        print("HAS_CHANGES=true")
        return 0
    print("HAS_CHANGES=false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
