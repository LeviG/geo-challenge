"""Fetch the USA tour data: state shapes (us-atlas) and state flags (Wikimedia Commons)."""
import json, os, time, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "geo-challenge")
UA = {"User-Agent": "GeoChallengeRemake/1.0 (personal fan remake; github.com/LeviG/geo-challenge)"}

# fips, postal, name, census division, area km2
STATES = [
    ("01", "AL", "Alabama", "East South Central", 135767), ("02", "AK", "Alaska", "Pacific", 1723337),
    ("04", "AZ", "Arizona", "Mountain", 295234), ("05", "AR", "Arkansas", "West South Central", 137732),
    ("06", "CA", "California", "Pacific", 423967), ("08", "CO", "Colorado", "Mountain", 269601),
    ("09", "CT", "Connecticut", "New England", 14357), ("10", "DE", "Delaware", "South Atlantic", 6446),
    ("12", "FL", "Florida", "South Atlantic", 170312), ("13", "GA", "Georgia", "South Atlantic", 153910),
    ("15", "HI", "Hawaii", "Pacific", 28313), ("16", "ID", "Idaho", "Mountain", 216443),
    ("17", "IL", "Illinois", "East North Central", 149995), ("18", "IN", "Indiana", "East North Central", 94326),
    ("19", "IA", "Iowa", "West North Central", 145746), ("20", "KS", "Kansas", "West North Central", 213100),
    ("21", "KY", "Kentucky", "East South Central", 104656), ("22", "LA", "Louisiana", "West South Central", 135659),
    ("23", "ME", "Maine", "New England", 91633), ("24", "MD", "Maryland", "South Atlantic", 32131),
    ("25", "MA", "Massachusetts", "New England", 27336), ("26", "MI", "Michigan", "East North Central", 250487),
    ("27", "MN", "Minnesota", "West North Central", 225163), ("28", "MS", "Mississippi", "East South Central", 125438),
    ("29", "MO", "Missouri", "West North Central", 180540), ("30", "MT", "Montana", "Mountain", 380831),
    ("31", "NE", "Nebraska", "West North Central", 200330), ("32", "NV", "Nevada", "Mountain", 286380),
    ("33", "NH", "New Hampshire", "New England", 24214), ("34", "NJ", "New Jersey", "Middle Atlantic", 22591),
    ("35", "NM", "New Mexico", "Mountain", 314917), ("36", "NY", "New York", "Middle Atlantic", 141297),
    ("37", "NC", "North Carolina", "South Atlantic", 139391), ("38", "ND", "North Dakota", "West North Central", 183108),
    ("39", "OH", "Ohio", "East North Central", 116098), ("40", "OK", "Oklahoma", "West South Central", 181037),
    ("41", "OR", "Oregon", "Pacific", 254799), ("42", "PA", "Pennsylvania", "Middle Atlantic", 119280),
    ("44", "RI", "Rhode Island", "New England", 4001), ("45", "SC", "South Carolina", "South Atlantic", 82933),
    ("46", "SD", "South Dakota", "West North Central", 199729), ("47", "TN", "Tennessee", "East South Central", 109153),
    ("48", "TX", "Texas", "West South Central", 695662), ("49", "UT", "Utah", "Mountain", 219882),
    ("50", "VT", "Vermont", "New England", 24906), ("51", "VA", "Virginia", "South Atlantic", 110787),
    ("53", "WA", "Washington", "Pacific", 184661), ("54", "WV", "West Virginia", "South Atlantic", 62756),
    ("55", "WI", "Wisconsin", "East North Central", 169635), ("56", "WY", "Wyoming", "Mountain", 253335),
]
REGION = {"New England": "Northeast", "Middle Atlantic": "Northeast", "East North Central": "Midwest",
          "West North Central": "Midwest", "South Atlantic": "South", "East South Central": "South",
          "West South Central": "South", "Mountain": "West", "Pacific": "West"}
FLAG_TITLE = {"Georgia": "Flag of Georgia (U.S. state).svg", "Washington": "Flag of Washington.svg"}


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 + attempt * 4)


flag_dir = os.path.join(OUT, "img", "us-flags")
os.makedirs(flag_dir, exist_ok=True)
for fips, postal, name, div, area in STATES:
    p = os.path.join(flag_dir, postal.lower() + ".png")
    if os.path.exists(p):
        continue
    title = FLAG_TITLE.get(name, f"Flag of {name}.svg").replace(" ", "_")
    open(p, "wb").write(get("https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.request.quote(title) + "?width=320"))
    time.sleep(0.5)

topo = json.loads(get("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json"))
del topo["objects"]["nation"]
states = [{"id": f, "cca2": p.lower(), "name": n, "subregion": d, "region": REGION[d], "area": a}
          for f, p, n, d, a in STATES]
with open(os.path.join(OUT, "data", "usa.js"), "w", encoding="utf-8") as f:
    f.write("window.US_TOPO=" + json.dumps(topo, separators=(",", ":")) + ";\n")
    f.write("window.US_STATES=" + json.dumps(states, separators=(",", ":")) + ";\n")
print("states", len(states), "flags", len(os.listdir(flag_dir)))
