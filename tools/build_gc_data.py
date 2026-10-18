import json, os, re, sys, time, urllib.request, urllib.parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "geo-challenge")
UA = {"User-Agent": "GeoChallengeRemake/1.0 (personal offline game; levi)"}


def get(url, binary=False):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else data.decode("utf-8")
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)


os.makedirs(os.path.join(OUT, "lib"), exist_ok=True)
os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
os.makedirs(os.path.join(OUT, "img", "flags"), exist_ok=True)
os.makedirs(os.path.join(OUT, "img", "landmarks"), exist_ok=True)

libs = {
    "d3.min.js": "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
    "topojson-client.min.js": "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js",
}
for name, url in libs.items():
    p = os.path.join(OUT, "lib", name)
    if not os.path.exists(p):
        open(p, "wb").write(get(url, True))
    print("lib", name, os.path.getsize(p))

topo = json.loads(get("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json"))
meta = json.loads(get("https://cdn.jsdelivr.net/gh/mledoze/countries@v5.0.0/countries.json"))

by_ccn3 = {c.get("ccn3"): c for c in meta if c.get("ccn3")}
countries = []
for g in topo["objects"]["countries"]["geometries"]:
    gid = g.get("id")
    c = by_ccn3.get(gid)
    if not c or not c.get("unMember"):
        continue
    countries.append({
        "id": gid,
        "cca2": c["cca2"].lower(),
        "name": c["name"]["common"],
        "region": c.get("region"),
        "subregion": c.get("subregion"),
        "area": c.get("area", 0),
    })
print("countries", len(countries))

for c in countries:
    p = os.path.join(OUT, "img", "flags", c["cca2"] + ".svg")
    if not os.path.exists(p):
        try:
            open(p, "wb").write(get(f"https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/{c['cca2']}.svg", True))
        except Exception as e:
            print("flag fail", c["cca2"], e)

with open(os.path.join(OUT, "data", "world.js"), "w", encoding="utf-8") as f:
    f.write("window.WORLD_TOPO=" + json.dumps(topo, separators=(",", ":")) + ";\n")
    f.write("window.COUNTRIES=" + json.dumps(countries, ensure_ascii=False, separators=(",", ":")) + ";\n")

landmarks = json.load(open(os.path.join(os.path.dirname(__file__), "landmarks_src.json"), encoding="utf-8"))
out_lm = []
for lm in landmarks:
    slug = re.sub(r"[^a-z0-9]+", "-", lm["title"].lower()).strip("-")
    p = os.path.join(OUT, "img", "landmarks", slug + ".jpg")
    if not os.path.exists(p):
        try:
            if lm.get("file"):  # the article's lead image is unusable (e.g. non-free); use this Commons file instead
                open(p, "wb").write(get("https://commons.wikimedia.org/wiki/Special:FilePath/" +
                                        urllib.parse.quote(lm["file"].replace(" ", "_")) + "?width=330", True))
                out_lm.append({**lm, "img": f"img/landmarks/{slug}.jpg"})
                continue
            s = json.loads(get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(lm["title"].replace(" ", "_"))))
            src = (s.get("thumbnail") or {}).get("source")
            if not src:
                print("no image", lm["title"]); continue
            src = re.sub(r"/\d+px-", "/640px-", src)
            try:
                data = get(src, True)
            except Exception:
                data = get(s["thumbnail"]["source"], True)
            open(p, "wb").write(data)
            time.sleep(0.3)
        except Exception as e:
            print("landmark fail", lm["title"], e); continue
    out_lm.append({**lm, "img": f"img/landmarks/{slug}.jpg"})
print("landmarks", len(out_lm))
with open(os.path.join(OUT, "data", "landmarks.js"), "w", encoding="utf-8") as f:
    f.write("window.LANDMARKS=" + json.dumps(out_lm, ensure_ascii=False, indent=0) + ";\n")
