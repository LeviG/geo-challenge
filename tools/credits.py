"""Look up author + license of every landmark photo and write CREDITS.md. Flags non-free images."""
import html, json, os, re, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
UA = {"User-Agent": "GeoChallengeRemake/1.0 (fan remake; github.com/LeviG/geo-challenge)"}


def get_json(url):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if attempt == 5 or e.code not in (429, 500, 502, 503):
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1))


def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


landmarks = json.load(open(os.path.join(ROOT, "tools", "landmarks_src.json"), encoding="utf-8"))
rows, problems = [], []
for lm in landmarks:
    if lm.get("file"):
        fname, on_commons = lm["file"], True
    else:
        s = get_json("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(lm["title"].replace(" ", "_")))
        src = (s.get("originalimage") or s.get("thumbnail") or {}).get("source", "")
        m = re.search(r"/(?:commons|en)/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/?]+)", src)
        if not m:
            problems.append((lm["title"], "no image url " + src)); continue
        fname = urllib.parse.unquote(m.group(1))
        on_commons = "/commons/" in src
    api = ("https://commons.wikimedia.org" if on_commons else "https://en.wikipedia.org") + \
        "/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&format=json&titles=" + urllib.parse.quote("File:" + fname)
    pages = get_json(api)["query"]["pages"]
    info = next(iter(pages.values())).get("imageinfo", [{}])[0]
    meta = info.get("extmetadata", {})
    lic = strip(meta.get("LicenseShortName", {}).get("value"))
    artist = " ".join(strip(meta.get("Artist", {}).get("value")).split()) or "Unknown"
    nonfree = meta.get("NonFree", {}).get("value") == "true" or not on_commons or not lic
    page = info.get("descriptionurl", "")
    rows.append((lm["name"], artist, lic, page))
    if nonfree:
        problems.append((lm["title"], f"NON-FREE / not on Commons: {lic} {page}"))
    time.sleep(1.5)

with open(os.path.join(ROOT, "CREDITS.md"), "w", encoding="utf-8") as f:
    f.write("# Credits\n\n")
    f.write("Geo Challenge is a fan-made tribute to *Geo Challenge* by Playfish (2008–2011). "
            "It contains no Playfish code or artwork.\n\n")
    f.write("## Data and libraries\n\n"
            "- Country and state shapes: [Natural Earth](https://www.naturalearthdata.com/) (public domain) via "
            "[world-atlas](https://github.com/topojson/world-atlas) and [us-atlas](https://github.com/topojson/us-atlas) (ISC)\n"
            "- Country metadata: [mledoze/countries](https://github.com/mledoze/countries) (ODbL 1.0)\n"
            "- Country flags: [flag-icons](https://github.com/lipis/flag-icons) (MIT)\n"
            "- US state flags: [Wikimedia Commons](https://commons.wikimedia.org/) (public domain)\n"
            "- [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client) (ISC)\n\n")
    f.write("## Landmark photos\n\nAll from Wikimedia Commons, resized to 330 px wide.\n\n| Landmark | Author | License | Source |\n|---|---|---|---|\n")
    for name, artist, lic, page in sorted(rows):
        f.write(f"| {name} | {artist.replace('|', '/')[:80]} | {lic} | [file page]({page}) |\n")

print(len(rows), "credited")
for p in problems:
    print("PROBLEM", p)
