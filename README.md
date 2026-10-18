# Geo Challenge

A fan-made remake of **Geo Challenge**, the Playfish geography game that ran on Facebook from
2008 until EA shut it down on 30 September 2011. The original's Flash files were never
archived, so this is a rebuild from memory and from Playfish's press screenshots.

**Play it:** https://games.levi-704.workers.dev/geo-challenge/

## The game

Pick a tour (World, Europe or USA) and fly through four rounds:

1. **Baggage claim:** a country (or state) is called out; grab the suitcase with its flag. 45 seconds, speed bonus, an express bonus for every 3 in a row.
2. **Passport control:** name the country from its outline. 45 seconds.
3. **Departures:** pin 8 cities on the map. Points for distance and speed, a bonus for a bullseye.
4. **Sightseeing:** pin 8 landmark photos on the map.

High scores are kept in your browser's local storage against a few made-up rivals.

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
