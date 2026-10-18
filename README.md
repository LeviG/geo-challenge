# Geo Challenge

A fan-made remake of **Geo Challenge**, the Playfish geography game that ran on Facebook from
2008 until EA shut it down on 30 September 2011. The original's Flash files were never
archived, so this is a rebuild from memory and from Playfish's press screenshots.

**Play it:** https://games.levi-704.workers.dev/geo-challenge/

## The game

Pick a tour (World, Europe or USA) and fly through four 60-second rounds:

1. **Baggage claim:** a country (or state) is called out; grab the suitcase with its flag.
2. **Map Mayhem:** name the country from its outline.
3. **City Blitz:** pin as many cities on the map as you can.
4. **Sightseeing:** pin landmark photos on the map.

High scores are kept in your browser's local storage against a few made-up rivals.

## Scoring

The original's rules were never published, so this is a reconstruction from Playfish's press
screenshots and players' notes from the time:

| Rule | Evidence |
|---|---|
| A 12-dot streak meter under the clock fills green → red with each correct answer in a row and empties on a miss. Each lit dot adds ×0.2, up to ×3.4. | Press screenshots: 2 dots lit while answers paid +48; ~10 lit (orange/red) while answers paid +140 |
| Answering within 1.5 s scores ×1.5, sliding down to ×0.8 at 4 s (City Blitz: 2 s → 5 s). | [Fan tips blog](https://geochallengetips.blogspot.com/): "less than two seconds … 1,5", "above 4 seconds … 0,8"; "Speed bonus!" in the screenshots |
| Every 10 in a row puts 5 seconds back on the clock. | Same blog: "10 answers in the raw … 5 seconds bonus" |
| "3 IN ROW" pays a flat +100. | Press screenshot of the flag round |
| A near-perfect City Blitz pin scores ×1.8. | Same blog |
| Harder (less famous) countries are worth more: 40–80 base points. | Same blog: "harder questions award more points" |

Base points, the exact speed curve between the thresholds, round length and what counts as a
"correct" City Blitz pin (within half the tour's range) are guesses.

## Layout

```
public/
  index.html          games landing page (served at /)
  geo-challenge/      the game: plain HTML + JS, no build step, plays offline from disk
tools/                Python scripts that fetch the map, flag and photo data
wrangler.jsonc        Cloudflare Worker (static assets only)
```

Open `public/geo-challenge/index.html` straight from disk to play locally.
Append `?round=3` to the game URL to skip straight to a round while testing.

## Rebuilding the data

```sh
python tools/build_gc_data.py   # world map, country flags, landmark photos
python tools/build_us_data.py   # state shapes and state flags
python tools/credits.py         # photo authors and licenses -> CREDITS.md
```

## Deploying

```sh
npx wrangler deploy
```

## Credits

See [CREDITS.md](CREDITS.md). Code is MIT-licensed; data and photos keep their own licenses.
Geo Challenge was created by Playfish; this project is not affiliated with Playfish or EA.
