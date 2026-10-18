(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");
  const play = $("#play");
  const EARTH_KM = 6371;

  // ---------------------------------------------------------------- storage
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("geochallenge." + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("geochallenge." + key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  // ---------------------------------------------------------------- sound
  const sound = {
    ctx: null,
    on: store.get("sound", true),
    tone(freq, dur, type = "sine", vol = 0.18, delay = 0) {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t); o.stop(t + dur);
      } catch { /* no audio */ }
    },
    right() { this.tone(660, .12, "triangle"); this.tone(990, .2, "triangle", .18, .09); },
    wrong() { this.tone(180, .3, "sawtooth", .12); },
    combo() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .18, "square", .08, i * .07)); },
    tick() { this.tone(1200, .05, "square", .05); },
    pin() { this.tone(420, .08, "triangle", .2); },
    end() { [784, 659, 523].forEach((f, i) => this.tone(f, .25, "triangle", .15, i * .15)); },
  };
  const soundBtn = $("#btn-sound");
  const paintSound = () => { soundBtn.textContent = sound.on ? "🔊" : "🔇"; };
  soundBtn.onclick = () => { sound.on = !sound.on; store.set("sound", sound.on); paintSound(); };
  paintSound();

  // ---------------------------------------------------------------- stage scaling
  function fit() {
    const s = Math.min(window.innerWidth / 1020, window.innerHeight / 660);
    stage.style.transform = `scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  // ---------------------------------------------------------------- data
  const topo = window.WORLD_TOPO;
  const features = topojson.feature(topo, topo.objects.countries).features;
  // Some territories share their country's numeric id (e.g. Ashmore Is. with Australia); merge them.
  const featureById = new Map();
  for (const f of features) {
    const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
    const prev = featureById.get(f.id);
    if (prev) prev.geometry.coordinates.push(...polys);
    else featureById.set(f.id, { type: "Feature", id: f.id, geometry: { type: "MultiPolygon", coordinates: polys.slice() } });
  }
  const seen = new Set();
  const COUNTRIES = window.COUNTRIES.filter((c) => featureById.has(c.id) && !seen.has(c.id) && seen.add(c.id));
  const CITIES = window.CITIES.map(([name, country, lat, lon, eu]) => ({ name, country, lat, lon, eu: !!eu }));
  const LANDMARKS = window.LANDMARKS || [];

  const usTopo = window.US_TOPO;
  const usFeatures = topojson.feature(usTopo, usTopo.objects.states).features;
  const usFeatureById = new Map(usFeatures.map((f) => [f.id, f]));
  const US_STATES = window.US_STATES.filter((s) => usFeatureById.has(s.id));
  const US_CITIES = window.US_CITIES.map(([name, state, lat, lon]) => ({ name, country: state, lat, lon }));

  // Early questions come from well-known places; the pool widens as the round goes on.
  const fame = (codes) => {
    const set = new Set(codes.split(" "));
    return (a, b) => (set.has(b.cca2) - set.has(a.cca2)) || b.area - a.area;
  };
  const byFame = fame("us gb fr de it es pt nl be ch at se no dk fi ie gr tr ru ua pl cz hu " +
    "ca mx br ar cl co pe cu jm cn jp kr in pk th vn id ph my sg sa ae il ir iq eg ma za ng ke et au nz is hr");
  const byStateFame = fame("ca tx ny fl hi ak wa az nv co il ma la ga ut or mi pa nj tn");
  const worldMap = { features, featureById, flag: (c) => `img/flags/${c.cca2}.svg` };
  const TOURS = {
    world: {
      name: "World Tour", unit: "country", ...worldMap,
      countries: COUNTRIES.slice().sort(byFame),
      outlines: COUNTRIES.filter((c) => c.area >= 20000).sort(byFame),
      cities: CITIES,
      landmarks: LANDMARKS.filter((l) => l.world !== false),
      maxKm: 2000, bullseyeKm: 50, maxZoom: 14,
    },
    europe: {
      name: "Europe Tour", unit: "country", ...worldMap,
      countries: COUNTRIES.filter((c) => c.region === "Europe").sort(byFame),
      outlines: COUNTRIES.filter((c) => c.region === "Europe" && c.area >= 1000).sort(byFame),
      cities: CITIES.filter((c) => c.eu),
      landmarks: LANDMARKS.filter((l) => l.eu),
      maxKm: 700, bullseyeKm: 25, maxZoom: 8,
    },
    usa: {
      name: "USA Tour", unit: "state",
      features: usFeatures, featureById: usFeatureById, flag: (c) => `img/us-flags/${c.cca2}.png`,
      countries: US_STATES.slice().sort(byStateFame),
      outlines: US_STATES.slice().sort(byStateFame),
      cities: US_CITIES,
      landmarks: LANDMARKS.filter((l) => l.us),
      maxKm: 800, bullseyeKm: 25, maxZoom: 10,
    },
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fmt = (n) => n.toLocaleString("en-US");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- high scores
  const RIVALS = {
    world: [["Captain Atlas", "🧭", 2600], ["Globetrotter Gwen", "🧳", 1900], ["Postcard Pete", "📮", 1300], ["Rookie Rita", "🎒", 700]],
    europe: [["Eurail Erik", "🚆", 2400], ["Croissant Claire", "🥐", 1700], ["Gondola Gio", "🛶", 1100], ["Backpack Ben", "🎒", 600]],
    usa: [["Route 66 Ruth", "🚗", 2500], ["Big Apple Al", "🍎", 1800], ["Cowboy Cody", "🤠", 1200], ["Surfer Sam", "🏄", 650]],
  };
  function highScores(tour) {
    const list = store.get("scores." + tour, null);
    if (list) return list;
    return RIVALS[tour].map(([name, av, score]) => ({ name, av, score, bot: true }));
  }
  function saveScore(tour, entry) {
    const list = highScores(tour).concat(entry).sort((a, b) => b.score - a.score).slice(0, 10);
    store.set("scores." + tour, list);
    return list;
  }

  // ---------------------------------------------------------------- game state
  const state = { tour: "world", score: 0, rounds: [], roundScore: 0, active: null, runId: 0 };
  const scoreEl = $("#score");
  const gainEl = $("#score-gain");
  let gainTimer = 0;

  function addScore(n, label) {
    if (n <= 0) return;
    state.score += n; state.roundScore += n;
    scoreEl.textContent = fmt(state.score);
    gainEl.textContent = (label ? label + " " : "") + "+" + n;
    gainEl.classList.add("show");
    clearTimeout(gainTimer);
    gainTimer = setTimeout(() => gainEl.classList.remove("show"), 900);
    renderLeaderboard();
  }

  function playerName() { return ($("#player-name").value || "").trim() || "You"; }

  function renderLeaderboard() {
    const tour = state.tour;
    $("#lb-title").textContent = TOURS[tour].name;
    const rows = highScores(tour).slice(0, 5).map((r) => ({ ...r }));
    if (!stage.classList.contains("in-menu")) rows.push({ name: playerName(), av: "😎", score: state.score, me: true });
    rows.sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
    $("#lb").innerHTML = rows.slice(0, 5).map((r, i) => `
      <li class="${r.me ? "me" : ""}"><span class="rk">${i + 1}</span>
        <span class="av">${r.av || "🙂"}</span>
        <span class="who"><div class="nm">${escapeHtml(r.name)}</div><div class="sc">${fmt(r.score)}</div></span></li>`).join("");
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------------- fx
  function floatText(text, x, y, cls = "") {
    const el = document.createElement("div");
    el.className = "float " + cls;
    el.textContent = text;
    el.style.left = x + "px"; el.style.top = y + "px";
    $("#fx").appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function stamp(streak) {
    const el = document.createElement("div");
    el.className = "stamp";
    el.innerHTML = `<div><small>EXPRESS</small>${streak} IN<br>A ROW<small>EXPRESS</small></div>`;
    $("#fx").appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---------------------------------------------------------------- board + clock
  function board(text, sub = "") { $("#board-text").textContent = text; $("#board-sub").textContent = sub; }

  const clock = {
    el: $("#clock"), num: $("#clock-num"), bar: $("#clock-bar i"), hand: $("#clock-hand"),
    raf: 0, end: 0, total: 0, onEnd: null, lastSec: -1,
    start(seconds, onEnd) {
      this.stop();
      this.total = seconds * 1000; this.end = performance.now() + this.total; this.onEnd = onEnd; this.lastSec = -1;
      this.el.classList.remove("hidden");
      const loop = () => {
        const left = Math.max(0, this.end - performance.now());
        const sec = Math.ceil(left / 1000);
        this.num.textContent = sec;
        this.bar.style.width = (left / this.total) * 100 + "%";
        this.hand.style.transform = `rotate(${180 + (1 - left / this.total) * 360}deg)`;
        this.el.classList.toggle("low", sec <= 5);
        if (sec !== this.lastSec) { if (sec <= 5 && sec > 0 && this.lastSec !== -1) sound.tick(); this.lastSec = sec; }
        if (left <= 0) { const cb = this.onEnd; this.stop(); cb && cb(); return; }
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    },
    remaining() { return Math.max(0, (this.end - performance.now()) / 1000); },
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.onEnd = null; },
    hide() { this.stop(); this.el.classList.add("hidden"); this.el.classList.remove("low"); },
  };

  // ---------------------------------------------------------------- screens
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
  }

  function talk(title, text) {
    show("screen-talk");
    $("#talk-title").textContent = title;
    $("#talk-text").textContent = text;
    return new Promise((resolve) => {
      const go = () => { cleanup(); show(null); resolve(); };
      const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      const cleanup = () => { $("#talk-go").onclick = null; document.removeEventListener("keydown", key); };
      $("#talk-go").onclick = go;
      document.addEventListener("keydown", key);
      state.cancelTalk = () => { cleanup(); resolve("quit"); };
    });
  }

  // ---------------------------------------------------------------- quiz rounds (flags / outlines)
  function chooseOptions(pool, correct, n = 4) {
    const near = shuffle(pool.filter((c) => c !== correct && c.subregion === correct.subregion));
    const region = shuffle(pool.filter((c) => c !== correct && c.region === correct.region && !near.includes(c)));
    const rest = shuffle(pool.filter((c) => c !== correct));
    const picked = [correct];
    for (const c of [...near.slice(0, 2), ...region.slice(0, 1), ...rest]) {
      if (picked.length >= n) break;
      if (!picked.includes(c)) picked.push(c);
    }
    return shuffle(picked);
  }

  function nextCountry(pool, asked) {
    const window_ = Math.min(pool.length, 25 + asked.size * 6);
    const fresh = pool.slice(0, window_).filter((c) => !asked.has(c.id));
    const c = pick(fresh.length ? fresh : pool);
    asked.add(c.id);
    return c;
  }

  function sprintRound({ seconds, renderQuestion }) {
    return new Promise((resolve) => {
      const run = state.runId;
      let streak = 0, locked = false, over = false, qStart = 0, current = null;

      const finish = () => { if (over) return; over = true; document.removeEventListener("keydown", onKey); clock.hide(); resolve(); };
      const onKey = (e) => { const n = Number(e.key); if (current && n >= 1 && n <= 4) current.choose(n - 1); };
      document.addEventListener("keydown", onKey);
      state.active = { stop: finish };

      const answer = (isRight, x, y) => {
        if (locked || over) return null;
        locked = true;
        if (isRight) {
          streak++;
          const elapsed = (performance.now() - qStart) / 1000;
          const pts = 50 + Math.max(0, Math.round(50 * (1 - elapsed / 5)));
          sound.right();
          addScore(pts);
          floatText("+" + pts, x, y, "small");
          if (streak % 3 === 0) {
            const bonus = 100 * (streak / 3);
            setTimeout(() => { if (over) return; sound.combo(); stamp(streak); addScore(bonus, streak + " in a row!"); floatText("+" + bonus, 410, 360); }, 250);
          }
        } else {
          streak = 0;
          sound.wrong();
        }
        return () => { if (over || run !== state.runId) return; locked = false; ask(); };
      };

      const ask = () => {
        if (over) return;
        qStart = performance.now();
        current = renderQuestion(answer);
      };

      clock.start(seconds, finish);
      ask();
    });
  }

  function flagsRound(tour) {
    const pool = TOURS[tour].countries;
    const asked = new Set();
    play.innerHTML = `<div class="belt-area"><div class="chute"></div><div class="belt"></div><div class="cases"></div>
      <div class="key-hint">Pick the suitcase with the right flag · keys 1–4</div></div>`;
    const casesEl = play.querySelector(".cases");
    let firstSet = true;

    return sprintRound({
      seconds: 45,
      renderQuestion(answer) {
        const correct = nextCountry(pool, asked);
        const opts = chooseOptions(pool, correct);
        board(correct.name);
        const build = () => {
          casesEl.innerHTML = opts.map((c, i) => `
            <button class="case" data-i="${i}" title="${i + 1}"><span class="handle"></span>
              <span class="body"><img src="${TOURS[tour].flag(c)}" alt="" draggable="false"></span><span class="mark"></span></button>`).join("");
          const cases = [...casesEl.children];
          requestAnimationFrame(() => requestAnimationFrame(() => cases.forEach((el, i) => {
            el.style.transitionDelay = (firstSet ? i * 0.08 : i * 0.05) + "s";
            el.classList.add("in");
          })));
          firstSet = false;
          const choose = (i) => {
            const el = cases[i];
            const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / 1000;
            const next = answer(opts[i] === correct, (r.left + r.width / 2 - s.left) / k, (r.top - s.top) / k);
            if (!next) return;
            const right = opts[i] === correct;
            el.classList.add(right ? "right" : "wrong");
            el.querySelector(".mark").textContent = right ? "✔" : "✘";
            if (!right) cases[opts.indexOf(correct)].classList.add("reveal");
            setTimeout(() => {
              cases.forEach((c, j) => { c.style.transitionDelay = j * 0.03 + "s"; c.classList.remove("in"); c.classList.add("out"); });
              setTimeout(next, 330);
            }, right ? 380 : 900);
          };
          cases.forEach((el, i) => { el.onclick = () => choose(i); });
          return { choose };
        };
        return build();
      },
    });
  }

  function outlineFeature(country, byId) {
    const f = byId.get(country.id);
    if (f.geometry.type !== "MultiPolygon") return f;
    const polys = f.geometry.coordinates.map((p) => {
      const g = { type: "Polygon", coordinates: p };
      return { p, area: d3.geoArea(g), c: d3.geoCentroid(g) };
    });
    const main = polys.reduce((a, b) => (b.area > a.area ? b : a));
    const keep = polys.filter((q) => q === main || q.area > main.area * 0.2 ||
      d3.geoDistance(q.c, main.c) * EARTH_KM < 800);
    return { type: "Feature", geometry: { type: "MultiPolygon", coordinates: keep.map((q) => q.p) } };
  }

  // Planar Mercator centred on the country. Spherical clipping turns tiny degenerate island rings
  // inside out (the whole globe gets filled), so outlines are projected by hand instead.
  function flatMercator(feat) {
    const [cx] = d3.geoCentroid(feat);
    const pt = ([lon, lat]) => [
      ((lon - cx + 540) % 360) - 180,
      (Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360)) * 180) / Math.PI,
    ];
    const polys = feat.geometry.type === "MultiPolygon" ? feat.geometry.coordinates : [feat.geometry.coordinates];
    return { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys.map((p) => p.map((ring) => ring.map(pt))) } };
  }

  function outlinesRound(tour) {
    const pool = TOURS[tour].outlines;
    const asked = new Set();
    play.innerHTML = `<div class="passport"><div class="shape-card"><span class="tag">PASSPORT CONTROL</span><svg width="300" height="240"></svg></div>
      <div class="opts"></div></div>`;
    const card = play.querySelector(".shape-card");
    const svg = d3.select(card.querySelector("svg"));
    const optsEl = play.querySelector(".opts");
    board(`Which ${TOURS[tour].unit} is this?`);

    return sprintRound({
      seconds: 45,
      renderQuestion(answer) {
        const correct = nextCountry(pool, asked);
        const opts = chooseOptions(pool, correct);
        const feat = outlineFeature(correct, TOURS[tour].featureById);
        const flat = flatMercator(feat);
        const proj = d3.geoIdentity().reflectY(true).fitExtent([[10, 10], [290, 230]], flat);
        svg.selectAll("*").remove();
        svg.append("path").attr("d", d3.geoPath(proj)(flat));
        card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");

        optsEl.innerHTML = opts.map((c, i) => `<button class="opt"><span class="k">${i + 1}</span>${escapeHtml(c.name)}</button>`).join("");
        const btns = [...optsEl.children];
        const choose = (i) => {
          const r = btns[i].getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / 1000;
          const next = answer(opts[i] === correct, (r.left + r.width / 2 - s.left) / k, (r.top - s.top) / k);
          if (!next) return;
          const right = opts[i] === correct;
          btns[i].classList.add(right ? "right" : "wrong");
          if (!right) btns[opts.indexOf(correct)].classList.add("right");
          setTimeout(next, right ? 450 : 1000);
        };
        btns.forEach((b, i) => { b.onclick = () => choose(i); });
        return { choose };
      },
    });
  }

  // ---------------------------------------------------------------- map rounds (cities / landmarks)
  const MAP_W = 778, MAP_H = 534;

  function buildMap(tour) {
    play.innerHTML = `<div class="map-wrap"><svg viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid slice"></svg>
      <div class="zoom-btns"><button data-z="1.6" title="Zoom in">+</button><button data-z="0.625" title="Zoom out">−</button></div>
      <div class="map-hint">Scroll to zoom · drag to pan · click to drop your pin</div></div>`;
    const wrap = play.querySelector(".map-wrap");
    const svg = d3.select(wrap.querySelector("svg"));
    const T = TOURS[tour];
    let projection;
    if (tour === "usa") {
      projection = d3.geoAlbersUsa().fitExtent([[14, 14], [MAP_W - 14, MAP_H - 14]], { type: "FeatureCollection", features: T.features });
    } else if (tour === "europe") {
      const frame = [];
      for (let lon = -25; lon <= 42; lon += 1) frame.push([lon, 34.5], [lon, 71]);
      for (let lat = 34.5; lat <= 71; lat += 1) frame.push([-25, lat], [42, lat]);
      projection = d3.geoConicConformal().rotate([-9, 0]).parallels([40, 65])
        .fitExtent([[6, 6], [MAP_W - 6, MAP_H - 6]], { type: "MultiPoint", coordinates: frame });
    } else {
      projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [MAP_W - 6, MAP_H - 6]], { type: "Sphere" });
    }
    const path = d3.geoPath(projection);
    const g = svg.append("g");
    if (tour !== "usa") { // Albers USA is a composite of three insets: no sphere or graticule to draw
      g.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));
      g.append("path").attr("class", "grat").attr("d", path(d3.geoGraticule10()));
    }
    g.append("g").selectAll("path").data(T.features).join("path").attr("class", "land").attr("d", path);
    const marks = g.append("g");

    let k = 1;
    const zoom = d3.zoom().scaleExtent([1, T.maxZoom])
      .translateExtent([[0, 0], [MAP_W, MAP_H]]).extent([[0, 0], [MAP_W, MAP_H]])
      .on("zoom", (e) => { k = e.transform.k; g.attr("transform", e.transform); marks.selectAll(".sym").attr("transform", function () { return `translate(${this.dataset.x},${this.dataset.y}) scale(${1 / k})`; }); });
    svg.call(zoom).on("dblclick.zoom", null);
    wrap.querySelectorAll(".zoom-btns button").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); svg.transition().duration(250).call(zoom.scaleBy, Number(b.dataset.z)); }; });

    const sym = (lonlat, html) => {
      const [x, y] = projection(lonlat);
      const el = marks.append("g").attr("class", "sym").attr("transform", `translate(${x},${y}) scale(${1 / k})`).html(html);
      el.node().dataset.x = x; el.node().dataset.y = y;
      return el;
    };

    return {
      svg, wrap,
      onClick(cb) {
        svg.on("click", (e) => {
          if (e.defaultPrevented) return;
          const [x, y] = d3.pointer(e, g.node());
          const ll = projection.invert([x, y]);
          if (!ll || Number.isNaN(ll[0]) || !projection(ll)) return; // Albers USA has no projection between its insets
          cb(ll);
        });
      },
      clear() { marks.selectAll("*").remove(); },
      dropPin(ll) {
        return sym(ll, `<line y2="-22" stroke="#1b2a41" stroke-width="2.5"/><circle cy="-24" r="8" fill="#e5383b" stroke="#fff" stroke-width="2"/>
          <ellipse rx="5" ry="2" fill="rgba(0,0,0,.3)"/>`);
      },
      reveal(guess, truth) {
        if (guess) {
          // A great-circle arc between Albers USA insets gets cut apart, so the USA map draws a straight line.
          const d = tour === "usa" ? `M${projection(guess)}L${projection(truth)}` : path({ type: "LineString", coordinates: [guess, truth] });
          marks.insert("path", ":first-child").attr("class", "guess-line").attr("d", d);
        }
        sym(truth, `<circle r="13" fill="rgba(63,179,79,.25)"/><circle r="7" fill="#3fb34f" stroke="#fff" stroke-width="2.5"/>`);
        const pts = [projection(truth)].concat(guess ? [projection(guess)] : []);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const scale = Math.max(1, Math.min(tour === "world" ? 6 : 5, 0.7 / Math.max((x1 - x0 + 60) / MAP_W, (y1 - y0 + 60) / MAP_H)));
        const t = d3.zoomIdentity.translate(MAP_W / 2, MAP_H / 2).scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
        svg.transition().duration(600).call(zoom.transform, t);
      },
      resetZoom() { svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity); },
    };
  }

  function mapRound(tour, kind) {
    const T = TOURS[tour];
    const items = shuffle(kind === "cities" ? T.cities : T.landmarks).slice(0, 8);
    const map = buildMap(tour);
    let photo = null;
    if (kind === "landmarks") {
      photo = document.createElement("div");
      photo.className = "photo-card";
      photo.innerHTML = `<img alt=""><div class="cap">Where is this?</div>`;
      map.wrap.appendChild(photo);
    }

    return new Promise((resolve) => {
      const run = state.runId;
      let i = 0, over = false, locked = true;
      const finish = () => { if (over) return; over = true; clock.hide(); resolve(); };
      state.active = { stop: finish };

      const settle = async (guess) => {
        if (locked || over) return;
        locked = true;
        clock.stop();
        const item = items[i];
        const truth = [item.lon, item.lat];
        const remaining = clock.remaining();
        let pts = 0, label;
        if (guess) {
          const km = Math.round(d3.geoDistance(guess, truth) * EARTH_KM);
          const base = Math.round(100 * Math.max(0, 1 - km / T.maxKm));
          const bull = km <= T.bullseyeKm ? 50 : 0;
          const time = base > 0 ? Math.round(remaining * 5) : 0;
          pts = base + bull + time;
          label = `${fmt(km)} km away${bull ? " · BULLSEYE!" : ""} · <b>+${pts}</b>`;
          if (pts > 0) { sound.right(); addScore(pts, bull ? "Bullseye!" : ""); floatText("+" + pts, 410, 300, bull ? "" : "small"); }
          else sound.wrong();
        } else {
          sound.wrong();
          label = "Out of time!";
        }
        map.reveal(guess, truth);
        const where = kind === "cities" ? `${item.name}, ${item.country}` : `${item.name} — ${item.place}`;
        const tag = document.createElement("div");
        tag.className = "result-tag";
        tag.innerHTML = `${escapeHtml(where)}<br><span style="font-size:15px">${label}</span>`;
        map.wrap.appendChild(tag);
        if (photo) { photo.querySelector(".cap").textContent = item.name; photo.classList.add("mini"); }
        await wait(2300);
        if (over || run !== state.runId) return;
        tag.remove();
        i++;
        if (i >= items.length) { finish(); return; }
        ask();
      };

      const ask = () => {
        const item = items[i];
        map.clear();
        map.resetZoom();
        if (kind === "cities") board(item.name, item.country + " · " + (i + 1) + " of " + items.length);
        else {
          board("Where in the world?", "Landmark " + (i + 1) + " of " + items.length);
          photo.classList.remove("mini");
          photo.querySelector("img").src = item.img;
          photo.querySelector(".cap").textContent = "Where is this?";
        }
        locked = false;
        clock.start(kind === "cities" ? 10 : 12, () => settle(null));
      };

      map.onClick((ll) => {
        if (locked || over) return;
        sound.pin();
        map.dropPin(ll);
        settle(ll);
      });
      ask();
    });
  }

  // ---------------------------------------------------------------- tour flow
  const ROUNDS = [
    { key: "flags", name: "Baggage Claim — flags", run: flagsRound,
      title: "Round 1 · Baggage claim",
      text: (u) => `Oh no, the luggage tags fell off! I'll call out a ${u}. Grab the suitcase with its flag. Quick answers score more, and every 3 in a row earns an express bonus. You have 45 seconds!` },
    { key: "outlines", name: "Passport Control — outlines", run: outlinesRound,
      title: "Round 2 · Passport control",
      text: (u) => `Every passport shows the outline of the traveller's home ${u}. Tell me which ${u} it is before the queue gets too long. 45 seconds on the clock!` },
    { key: "cities", name: "Departures — cities", run: (t) => mapRound(t, "cities"),
      title: "Round 3 · Departures",
      text: "Now we know who's going where, we're almost good to go! So let's find out which city everyone's heading to. That's where you come in: drop a pin on the map. Closer pins and faster answers score more." },
    { key: "landmarks", name: "Sightseeing — landmarks", run: (t) => mapRound(t, "landmarks"),
      title: "Round 4 · Sightseeing",
      text: "Last stop! Our travellers sent back holiday snaps but forgot to say where they took them. Pin each landmark on the map." },
  ];

  async function startTour(tour) {
    const run = ++state.runId;
    state.tour = tour; state.score = 0; state.rounds = [];
    scoreEl.textContent = "0";
    stage.classList.remove("in-menu");
    renderLeaderboard();
    play.innerHTML = "";
    board(TOURS[tour].name);

    let r = await talk("Welcome aboard!", `This is the Geo Challenge ${TOURS[tour].name}. Four rounds stand between you and the top of the leaderboard: flags, outlines, cities and landmarks. Ready for check-in?`);
    if (r === "quit" || run !== state.runId) return;

    const firstRound = Math.max(1, Number(new URLSearchParams(location.search).get("round")) || 1); // ?round=3 skips ahead
    for (const round of ROUNDS.slice(firstRound - 1)) {
      play.innerHTML = "";
      board(round.title);
      r = await talk(round.title, typeof round.text === "function" ? round.text(TOURS[tour].unit) : round.text);
      if (r === "quit" || run !== state.runId) return;
      state.roundScore = 0;
      await round.run(tour);
      if (run !== state.runId) return;
      state.rounds.push({ name: round.name, score: state.roundScore });
      await wait(400);
    }
    showResults(tour);
  }

  function showResults(tour) {
    sound.end();
    clock.hide();
    play.innerHTML = "";
    const before = highScores(tour);
    const prevBest = Math.max(0, ...before.filter((s) => !s.bot).map((s) => s.score));
    const entry = { name: playerName(), av: "😎", score: state.score, date: new Date().toISOString().slice(0, 10), mine: Date.now() };
    const list = saveScore(tour, entry);
    const rank = list.findIndex((s) => s.mine === entry.mine) + 1;

    $("#res-title").textContent = `Welcome home from the ${TOURS[tour].name}!`;
    $("#res-total").textContent = fmt(state.score);
    $("#res-msg").textContent = rank === 1 ? "🏆 You're top of the leaderboard!"
      : state.score > prevBest && prevBest > 0 ? "⭐ New personal best!"
      : rank ? `You placed #${rank} on the leaderboard.` : "Not quite on the board this time. Fly again!";
    $("#res-rounds").innerHTML = state.rounds.map((r) => `<tr><td>${r.name}</td><td>${fmt(r.score)}</td></tr>`).join("") +
      `<tr><td><b>Total</b></td><td>${fmt(state.score)}</td></tr>`;
    $("#res-hs-title").textContent = TOURS[tour].name + " high scores";
    $("#res-hs").innerHTML = list.map((s) => `<li class="${s.mine === entry.mine ? "me" : ""}"><span>${s.av || "🙂"} ${escapeHtml(s.name)}</span><span>${fmt(s.score)}</span></li>`).join("");
    stage.classList.add("in-menu");
    renderLeaderboard();
    show("screen-results");
  }

  function quitToMenu() {
    state.runId++;
    if (state.active) { const a = state.active; state.active = null; a.stop(); }
    if (state.cancelTalk) { const c = state.cancelTalk; state.cancelTalk = null; c(); }
    clock.hide();
    play.innerHTML = "";
    showMenu();
  }

  function showMenu() {
    stage.classList.add("in-menu");
    for (const t of Object.keys(TOURS)) {
      const mine = highScores(t).filter((s) => !s.bot);
      $(`[data-best="${t}"]`).textContent = mine.length ? "Your best: " + fmt(Math.max(...mine.map((s) => s.score))) : "Not played yet";
    }
    renderLeaderboard();
    show("screen-menu");
  }

  // ---------------------------------------------------------------- wiring
  const nameInput = $("#player-name");
  nameInput.value = store.get("name", "");
  nameInput.addEventListener("input", () => store.set("name", nameInput.value.trim()));
  document.querySelectorAll(".tour").forEach((b) => { b.onclick = () => { state.tour = b.dataset.tour; show(null); startTour(b.dataset.tour); }; });
  $("#btn-quit").onclick = quitToMenu;
  $("#res-again").onclick = () => { show(null); startTour(state.tour); };
  $("#res-menu").onclick = showMenu;

  showMenu();
})();
