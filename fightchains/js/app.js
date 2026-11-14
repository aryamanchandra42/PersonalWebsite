(function () {
  'use strict';

  var C = window.FightChain, F = window.FightFigures;
  var DIVISIONS = ['Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight', 'Lightweight', 'Featherweight',
    'Bantamweight', 'Flyweight', "Women's Bantamweight", "Women's Flyweight", "Women's Strawweight"];
  var STRENGTHS = [['striking', 'Striking'], ['power', 'Power'], ['wrestling', 'Wrestling'], ['control', 'Top control'], ['submissions', 'Submissions'], ['durability', 'Durability']];
  var STEP_MS = 340;
  var X_DIST = 48, X_CLINCH = 20, X_GROUND = 10, X_CORNER = 128;

  var data = {}, byName = {};
  var ui = {
    division: null, a: null, b: null, rounds: 3, speed: 1, pred: null, live: null
  };
  var sim = null, figA, figB, queue = [], rafOn = false, timer = null;
  var rng = { seed: 1 }, lastFight = null, watchingAgain = false;

  function $(id) { return document.getElementById(id); }
  function last(name) { var p = name.split(' '); return p.length > 1 ? p.slice(1).join(' ') : name; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function newSeed() { return ((Math.random() * 0xffffffff) | 1) >>> 0; }
  function rand() {
    var s = rng.seed | 0;
    s = s + 0x6D2B79F5 | 0;
    rng.seed = s;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function load() {
    return Promise.all(['fighters', 'matchups', 'league', 'backtest', 'photos'].map(function (k) {
      return fetch(new URL('data/' + k + '.json', document.baseURI)).then(function (r) {
        if (!r.ok) throw new Error(k);
        return r.json();
      }).then(function (j) { data[k] = j; }).catch(function (err) {
        if (k === 'photos') { data.photos = {}; return; }
        throw err;
      });
    }));
  }

  function photoOf(f) {
    if (!f) return '';
    if (f.photo) return f.photo;
    var p = data.photos && data.photos[f.name];
    return (p && p.url) || '';
  }
  function face(f, cls) {
    var src = photoOf(f);
    if (!src) return '<span class="face face-empty ' + (cls || '') + '" aria-hidden="true"></span>';
    return '<img class="face ' + (cls || '') + '" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy">';
  }
  function setFace(id, f) {
    var el = $(id);
    if (!el) return;
    var src = photoOf(f);
    if (src) { el.src = src; el.hidden = false; }
    else { el.removeAttribute('src'); el.hidden = true; }
  }

  // ---------- pickers ----------
  function divisionList() {
    return DIVISIONS.filter(function (d) { return data.fighters.some(function (f) { return f.division === d; }); });
  }

  function rosterOf(div) {
    return data.fighters.filter(function (f) { return f.division === div; }).sort(function (x, y) { return x.rank - y.rank; });
  }

  function fillSelect(sel, roster, chosen) {
    sel.innerHTML = roster.map(function (f) {
      return '<option value="' + esc(f.name) + '"' + (f.name === chosen ? ' selected' : '') + '>' + esc(f.name) + ' (' + f.record[0] + '-' + f.record[1] + ')</option>';
    }).join('');
  }

  function setMatchup(a, b, div) {
    ui.division = div || byName[a].division;
    ui.a = a; ui.b = b;
    $('pick-division').value = ui.division;
    var roster = rosterOf(ui.division);
    fillSelect($('pick-a'), roster, a);
    fillSelect($('pick-b'), roster, b);
    refresh();
  }

  function initPickers() {
    var divs = divisionList();
    $('pick-division').innerHTML = divs.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('');
    $('pick-division').addEventListener('change', function (e) {
      var card = (data.matchups[e.target.value] || [])[0];
      var roster = rosterOf(e.target.value);
      if (card) setMatchup(card.a, card.b, e.target.value);
      else setMatchup(roster[0].name, roster[1].name, e.target.value);
    });
    $('pick-a').addEventListener('change', function (e) {
      if (e.target.value === ui.b) { ui.b = ui.a; }
      setMatchup(e.target.value, ui.b, ui.division);
    });
    $('pick-b').addEventListener('change', function (e) {
      if (e.target.value === ui.a) { ui.a = ui.b; }
      setMatchup(ui.a, e.target.value, ui.division);
    });
    document.querySelectorAll('[data-rounds]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.rounds = +btn.dataset.rounds;
        document.querySelectorAll('[data-rounds]').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
        refresh();
      });
    });
    document.querySelectorAll('[data-speed]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.speed = +btn.dataset.speed;
        document.querySelectorAll('[data-speed]').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
      });
    });
    $('btn-play').addEventListener('click', togglePlay);
    $('btn-restart').addEventListener('click', startNewFight);
    $('result-again').addEventListener('click', startNewFight);
    $('result-watch').addEventListener('click', watchAgain);
    $('btn-watch-again').addEventListener('click', watchAgain);
  }

  // ---------- prediction and panels ----------
  function refresh() {
    var A = byName[ui.a], B = byName[ui.b];
    ui.pred = C.predict(A.rates, B.rates, ui.rounds, data.league);
    ui.live = C.liveChances(ui.pred.P, ui.rounds, data.league.steps_per_round);
    renderBreakdown(A, B, ui.pred);
    renderTape(A, B);
    renderMathLive(A, B, ui.pred);
    resetSim();
    hideLastFight();
  }

  function renderBreakdown(A, B, o) {
    $('odds-a-name').innerHTML = face(A, 'face-sm') + ' ' + esc(A.name);
    $('odds-b-name').innerHTML = esc(B.name) + ' ' + face(B, 'face-sm');
    $('odds-a').textContent = pct(o.pA);
    $('odds-b').textContent = pct(1 - o.pA);
    $('odds-bar-a').style.width = (o.pA * 100) + '%';
    $('odds-bar-b').style.width = ((1 - o.pA) * 100) + '%';
    var gap = Math.abs(o.pA - 0.5);
    var fav = o.pA >= 0.5 ? A : B;
    $('odds-note').textContent = gap < 0.04 ? 'A genuine coin flip. The kind of fight matchmakers dream about.'
      : gap < 0.12 ? last(fav.name) + ' is a slight favourite, but this one is live.'
      : last(fav.name) + ' is a clear favourite on style.';

    var s = o.split;
    var cats = [
      ['aKo', last(A.name) + ' by KO', 'c-a1'], ['aSub', last(A.name) + ' by submission', 'c-a2'], ['aDec', last(A.name) + ' on the cards', 'c-a3'],
      ['bDec', last(B.name) + ' on the cards', 'c-b3'], ['bSub', last(B.name) + ' by submission', 'c-b2'], ['bKo', last(B.name) + ' by KO', 'c-b1']
    ];
    var counts = largestRemainder(cats.map(function (c) { return s[c[0]]; }), 100);
    var dots = [];
    cats.forEach(function (c, i) { for (var k = 0; k < counts[i]; k++) dots.push(c[2]); });
    $('dots').innerHTML = dots.map(function (cls, i) { return '<i class="' + cls + '" style="animation-delay:' + (i * 8) + 'ms"></i>'; }).join('');
    $('ends-legend').innerHTML = cats.map(function (c, i) {
      return '<li><i class="' + c[2] + '"></i>' + esc(c[1]) + '<b>' + counts[i] + '</b></li>';
    }).join('');

    var rows = o.byRound.map(function (r, i) {
      return '<div class="rc-row"><span class="rc-label">R' + (i + 1) + '</span>' +
        '<div class="rc-bars"><div class="rc-a" style="width:' + (r.a * 100 * 2.2) + '%"></div><div class="rc-b" style="width:' + (r.b * 100 * 2.2) + '%"></div></div>' +
        '<span class="rc-val">' + pct(r.a + r.b) + '</span></div>';
    });
    rows.push('<div class="rc-row rc-judges"><span class="rc-label">Cards</span><div class="rc-bars"><div class="rc-j" style="width:' + (o.dec * 100 * 2.2) + '%"></div></div><span class="rc-val">' + pct(o.dec) + '</span></div>');
    $('rounds-chart').innerHTML = rows.join('') +
      '<div class="rc-key"><span><i class="c-a1"></i>' + esc(last(A.name)) + ' finishes</span><span><i class="c-b1"></i>' + esc(last(B.name)) + ' finishes</span></div>';

    var occ = o.occupancy, tot = occ.reduce(function (x, y) { return x + y; }, 0);
    var where = [['At range', occ[C.DIST], 'w-dist'], ['Clinch', occ[C.CLINCH], 'w-clinch'], [last(A.name) + ' on top', occ[C.A_TOP], 'w-atop'], [last(B.name) + ' on top', occ[C.B_TOP], 'w-btop']];
    $('where-bar').innerHTML = where.map(function (w) { return '<div class="' + w[2] + '" style="flex:' + w[1] + '"></div>'; }).join('');
    $('where-legend').innerHTML = where.map(function (w) { return '<li><i class="' + w[2] + '"></i>' + esc(w[0]) + '<b>' + pct(w[1] / tot) + '</b></li>'; }).join('');
  }

  function largestRemainder(values, total) {
    var sum = values.reduce(function (x, y) { return x + y; }, 0) || 1;
    var raw = values.map(function (v) { return v / sum * total; });
    var out = raw.map(Math.floor), left = total - out.reduce(function (x, y) { return x + y; }, 0);
    raw.map(function (v, i) { return [v - Math.floor(v), i]; }).sort(function (x, y) { return y[0] - x[0]; })
      .slice(0, left).forEach(function (r) { out[r[1]]++; });
    return out;
  }

  function tapeSide(f, corner) {
    var form = f.form.map(function (x) {
      return '<li class="form-' + x.r.toLowerCase() + '" title="' + esc(x.r + ' vs ' + x.vs + ' · ' + x.kind + ' · ' + x.date) + '">' + x.r + '<small>' + (x.kind === 'OTHER' ? '' : x.kind) + '</small></li>';
    }).join('');
    var st = f.style;
    var bits = [f.height && ('Height ' + f.height), f.reach && ('Reach ' + f.reach), f.stance].filter(Boolean).join(' · ');
    return face(f, 'face-lg') +
      '<p class="corner-tag">' + corner + ' corner</p>' +
      '<h3>' + esc(f.name) + '</h3>' +
      (f.nickname ? '<p class="nick">&ldquo;' + esc(f.nickname) + '&rdquo;</p>' : '') +
      '<p class="rec"><strong>' + f.record[0] + '-' + f.record[1] + '</strong> in the UFC &middot; ' + esc(f.division) + '</p>' +
      (bits ? '<p class="meta">' + esc(bits) + '</p>' : '') +
      '<p class="mini-h">Last five</p><ol class="form">' + form + '</ol>' +
      '<p class="mini-h">Where they spend their fights</p>' +
      '<div class="where-bar small"><div class="w-dist" style="flex:' + st.distance + '"></div><div class="w-clinch" style="flex:' + st.clinch + '"></div><div class="w-atop" style="flex:' + st.top + '"></div><div class="w-bottom" style="flex:' + st.bottom + '"></div></div>' +
      '<p class="where-key"><span><i class="w-dist"></i>Range ' + pct(st.distance) + '</span><span><i class="w-clinch"></i>Clinch ' + pct(st.clinch) + '</span><span><i class="w-atop"></i>On top ' + pct(st.top) + '</span><span><i class="w-bottom"></i>On bottom ' + pct(st.bottom) + '</span></p>';
  }

  function renderTape(A, B) {
    $('tape-a').innerHTML = tapeSide(A, 'Blue');
    $('tape-b').innerHTML = tapeSide(B, 'Red');
    $('butterfly').innerHTML = STRENGTHS.map(function (s) {
      var a = A.strengths[s[0]], b = B.strengths[s[0]];
      return '<div class="bf-row"><div class="bf-a"><div style="width:' + (a * 100) + '%" class="' + (a > b ? 'lead' : '') + '"></div></div>' +
        '<span class="bf-label">' + s[1] + '</span>' +
        '<div class="bf-b"><div style="width:' + (b * 100) + '%" class="' + (b > a ? 'lead' : '') + '"></div></div></div>';
    }).join('') + '<p class="bf-note">Compared with every active fighter in the UFC</p>';
  }

  function fmt(x, d) { return Number(x).toFixed(d == null ? 3 : d); }
  function mtx(headers, rows) {
    return '<table class="mtx"><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          var v = typeof c === 'number' ? fmt(c, i === 0 ? 3 : 3) : c;
          var cls = typeof c === 'number' && Math.abs(c) >= 0.02 && i ? ' hi' : '';
          return '<td class="' + cls + '">' + (typeof c === 'number' ? fmt(c) : c) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  function renderMathLive(A, B, o) {
    var box = $('math-live');
    if (!box) return;
    var L = data.league, names = ['DIST', 'CLINCH', 'A top', 'B top', 'A KO', 'A SUB', 'B KO', 'B SUB'];
    var Q = C.rateMatrix(A.rates, B.rates, L);
    var keys = [['td', 'Takedowns / min'], ['td_vuln', 'Takedown vulnerability'], ['clinch_share', 'Clinch share'],
      ['ko_stand', 'Standing KO'], ['ko_stand_vuln', 'KO vulnerability'], ['gnp', 'Ground KO'], ['sub', 'Submissions'],
      ['land_stand', 'Strikes landed, standing'], ['absorb_stand', 'Strikes absorbed, standing'],
      ['top_exit', 'Leave top'], ['rev', 'Sweeps']];
    var rateRows = keys.map(function (k) { return [k[1], A.rates[k[0]], B.rates[k[0]], L.rates[k[0]] || '']; });
    var qRows = Q.map(function (row, i) { return [names[i]].concat(row); });
    var s = o.split;
    box.innerHTML =
      '<p><strong>' + esc(A.name) + '</strong> vs <strong>' + esc(B.name) + '</strong> &middot; ' + ui.rounds + ' rounds. ' +
      'Raw chain \\(p_A=' + fmt(o.raw, 3) + '\\); after the logit shrink \\(\\alpha=' + fmt(L.stack[0], 3) + '\\), \\(p_A=' + fmt(o.pA, 3) + '\\). ' +
      'Decision share \\(\\sigma(z)=' + fmt(o.judgesA, 3) + '\\). Finish mass \\(1-d=' + fmt(1 - o.dec, 3) + '\\).</p>' +
      '<div class="math-split"><div><p class="mini-h">Rates (per minute)</p>' +
      mtx(['', esc(last(A.name)), esc(last(B.name)), 'League'], rateRows) +
      '</div><div><p class="mini-h">Expected minutes in position</p>' +
      mtx(['State', 'Minutes'], [['Distance', o.occupancy[0]], ['Clinch', o.occupancy[1]], [last(A.name) + ' on top', o.occupancy[2]], [last(B.name) + ' on top', o.occupancy[3]]]) +
      '<p class="mini-h">Outcome split</p>' +
      mtx(['', 'Probability'], [['A by KO', s.aKo], ['A by submission', s.aSub], ['A on the cards', s.aDec], ['B on the cards', s.bDec], ['B by submission', s.bSub], ['B by KO', s.bKo]]) +
      '</div></div>' +
      '<p class="mini-h">Rate matrix \\(Q\\) (per minute)</p>' +
      mtx(['from \\ to'].concat(names), qRows) +
      '<p class="note">Highlighted cells are rates of at least 0.02 per minute. \\(\\beta=(' +
      fmt(L.beta[0], 3) + ', ' + fmt(L.beta[1], 3) + ')\\), \\(c_{\\mathrm{KO}}=' + fmt(L.cal.ko_stand, 3) + '\\), \\(c_{\\mathrm{g}}=' + fmt(L.cal.ground, 3) + '\\).</p>';
    if (window.renderMathInElement) {
      window.renderMathInElement(box, { delimiters: [{ left: '\\(', right: '\\)', display: false }], throwOnError: false });
    }
  }

  // ---------- arena ----------
  function buildArena() {
    var g = $('fighters');
    figA = new F.Figure(g, { face: 1, color: '#2f6fd4', dark: '#163a8c', glove: '#c41e3a', x: -X_DIST });
    figB = new F.Figure(g, { face: -1, color: '#d62828', dark: '#8b1515', glove: '#c41e3a', x: X_DIST });
  }

  function now() { return performance.now(); }
  function later(ms, fn) { queue.push({ at: now() + ms / ui.speed, fn: fn }); }
  function dur(ms) { return ms / ui.speed; }

  function loop() {
    var t = now();
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].at <= t) { var job = queue.splice(i, 1)[0]; i--; job.fn(); }
    }
    figA.update(t); figB.update(t);
    requestAnimationFrame(loop);
  }

  function resetSim() {
    clearTimeout(timer);
    queue = [];
    sim = { state: C.DIST, t: 0, playing: false, done: false, log: [], hp: { A: 100, B: 100 } };
    var A = byName[ui.a], B = byName[ui.b];
    setHp('A', 100, { snap: true });
    setHp('B', 100, { snap: true });
    setFace('face-a', A); setFace('face-b', B);
    $('hud-a').textContent = A.name; $('hud-b').textContent = B.name;
    $('hud-a-rec').textContent = A.record[0] + '-' + A.record[1];
    $('hud-b-rec').textContent = B.record[0] + '-' + B.record[1];
    $('live-a-label').textContent = last(A.name) + ' finishes';
    $('live-b-label').textContent = last(B.name) + ' finishes';
    $('ticker').innerHTML = '';
    $('result').hidden = true;
    $('btn-play').textContent = 'Fight';
    setClock();
    setPhase('Touch gloves');
    var t = now();
    figA.set('stance', 300, -X_DIST, t); figB.set('stance', 300, X_DIST, t);
    updateLive();
  }

  function togglePlay() {
    if (!sim || sim.done) { startNewFight(); return; }
    if (sim.playing) pause(); else play();
  }
  function startNewFight() {
    watchingAgain = false;
    lastFight = { seed: newSeed(), a: ui.a, b: ui.b, rounds: ui.rounds, events: [], result: null };
    rng.seed = lastFight.seed;
    hideLastFight();
    resetSim();
    play();
  }
  function watchAgain() {
    if (!lastFight || !lastFight.result) return;
    watchingAgain = true;
    rng.seed = lastFight.seed;
    lastFight.events = [];
    resetSim();
    play();
    document.getElementById('arena').scrollIntoView({ behavior: 'smooth' });
  }
  function play() {
    if (sim.done) return;
    if (!watchingAgain && (!lastFight || lastFight.result || lastFight.a !== ui.a || lastFight.b !== ui.b || lastFight.rounds !== ui.rounds)) {
      lastFight = { seed: newSeed(), a: ui.a, b: ui.b, rounds: ui.rounds, events: [], result: null };
      rng.seed = lastFight.seed;
    }
    sim.playing = true;
    $('btn-play').textContent = 'Pause';
    if (sim.t === 0 && !sim.log.length) {
      tick('Round 1. Fight!');
      flash('ROUND 1');
    }
    schedule();
  }
  function pause() {
    sim.playing = false;
    clearTimeout(timer);
    $('btn-play').textContent = 'Resume';
  }
  function schedule(extra) {
    clearTimeout(timer);
    timer = setTimeout(step, dur(STEP_MS + (extra || 0)));
  }

  function setClock() {
    var steps = data.league.steps_per_round, r = Math.floor(sim.t / steps), inRound = sim.t % steps;
    var left = (steps - inRound) * data.league.dt_sec;
    if (sim.t > 0 && inRound === 0 && !sim.done) { r -= 1; left = 0; }
    r = Math.min(r, ui.rounds - 1);
    $('hud-round').textContent = 'Round ' + (r + 1) + ' of ' + ui.rounds;
    $('hud-time').textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
  }

  function setPhase(text) { $('hud-phase').textContent = text; }

  function hitDamage(atk, def, kind) {
    var base = { jab: 0.62, cross: 1.15, hook: 1.05, overhand: 1.28, kick: 1.45, knee: 0.95, ground: 0.88 }[kind] || 0.9;
    var power = (atk.strengths && atk.strengths.power) || 0.5;
    var dura = (def.strengths && def.strengths.durability) || 0.5;
    return base * (0.65 + power * 0.75) / (0.55 + dura * 0.9) * (0.72 + rand() * 0.5);
  }

  function setHp(who, value, opts) {
    opts = opts || {};
    if (!sim || !sim.hp) return;
    var next = Math.max(opts.floor != null ? opts.floor : 0, Math.min(100, value));
    sim.hp[who] = next;
    var id = who.toLowerCase();
    var fill = $('hp-' + id), ghost = $('hp-ghost-' + id), wrap = $('hp-wrap-' + id);
    if (!fill) return;
    fill.style.width = next + '%';
    fill.classList.toggle('mid', next <= 60 && next > 30);
    fill.classList.toggle('low', next <= 30);
    $('hp-val-' + id).textContent = String(Math.round(next));
    wrap.setAttribute('aria-valuenow', String(Math.round(next)));
    if (opts.hit) {
      wrap.classList.add('hit');
      clearTimeout(setHp['h' + who]);
      setHp['h' + who] = setTimeout(function () { wrap.classList.remove('hit'); }, 180);
    }
    clearTimeout(setHp['g' + who]);
    if (opts.snap) {
      ghost.style.width = next + '%';
    } else {
      setHp['g' + who] = setTimeout(function () {
        if (sim) ghost.style.width = sim.hp[who] + '%';
      }, 420 / Math.sqrt(ui.speed));
    }
  }

  function hurt(who, amount) {
    setHp(who, sim.hp[who] - amount, { floor: sim.done ? 0 : 8, hit: true });
  }

  function flash(text, cls) {
    var f = $('flash');
    f.textContent = text;
    f.className = 'flash show ' + (cls || '');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () { f.className = 'flash'; }, 1100 / Math.sqrt(ui.speed));
  }

  function tick(text, cls, stamp) {
    if (!stamp) {
      var steps = data.league.steps_per_round, r = Math.min(ui.rounds, Math.floor(Math.max(0, sim.t - 1) / steps) + 1);
      var secs = sim.t === 0 ? 0 : ((sim.t - 1) % steps + 1) * data.league.dt_sec;
      stamp = 'R' + r + ' ' + Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2);
    }
    var li = document.createElement('li');
    li.className = cls || '';
    li.innerHTML = '<time>' + stamp + '</time>' + esc(text);
    var list = $('ticker');
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 4) list.removeChild(list.lastChild);
    var entry = { stamp: stamp, text: text, cls: cls || '' };
    sim.log.push(entry);
    if (lastFight) {
      lastFight.events.push(entry);
      renderLastLog();
    }
  }

  function updateLive() {
    var t = Math.min(sim.t, ui.live.A.length - 1), s = sim.state;
    var a = ui.live.A[t][s], b = ui.live.B[t][s];
    if (sim.done) { a = sim.winner === 'A' ? 1 : 0; b = sim.winner === 'B' ? 1 : 0; }
    var j = Math.max(0, 1 - a - b);
    if (sim.done && sim.method === 'DEC') { a = 0; b = 0; j = 1; }
    [['live-a', a], ['live-j', j], ['live-b', b]].forEach(function (p) {
      var el = $(p[0]);
      el.style.flexGrow = Math.max(0.0001, p[1]);
      el.firstChild.textContent = p[1] >= 0.07 ? pct(p[1]) : '';
    });
  }

  function sampleRow(row) {
    var u = rand(), acc = 0;
    for (var j = 0; j < row.length; j++) { acc += row[j]; if (u < acc) return j; }
    return row.length - 1;
  }

  function step() {
    if (!sim.playing || sim.done) return;
    var steps = data.league.steps_per_round, P = ui.pred.P;
    var prev = sim.state, next = sampleRow(P[prev]);
    sim.t += 1;
    sim.state = next;
    setClock();
    var extra = 0;
    if (next === prev) ambient(prev);
    else extra = transition(prev, next);

    if (next >= C.NT) { updateLive(); return; }
    if (sim.t % steps === 0) {
      if (sim.t >= ui.rounds * steps) { decision(); return; }
      roundBreak(sim.t / steps + 1);
      return;
    }
    updateLive();
    schedule(extra);
  }

  // Fighter positions for each state.
  function placeFor(state, ms) {
    var t = now(), d = dur(ms);
    if (state === C.DIST) {
      var drift = (rand() - 0.5) * 24;
      figA.set(rand() < 0.45 ? 'bounce' : 'stance', d, -X_DIST + drift, t);
      figB.set(rand() < 0.45 ? 'bounce' : 'stance', d, X_DIST + drift, t);
    } else if (state === C.CLINCH) {
      figA.set('clinch', d, -X_CLINCH, t); figB.set('clinch', d, X_CLINCH, t);
    } else if (state === C.A_TOP) {
      figA.set('top', d, -X_GROUND, t); figB.set('bottom', d, X_GROUND, t);
    } else if (state === C.B_TOP) {
      figB.set('top', d, X_GROUND, t); figA.set('bottom', d, -X_GROUND, t);
    }
  }

  function strikeRate(off, def, state) {
    var L = data.league.rates, dt = data.league.dt_sec / 60;
    if (state === 'stand') return C.combo(off.land_stand, def.absorb_stand, L.land_stand) * dt;
    return C.combo(off.land_ground, def.absorb_ground, L.land_ground) * dt;
  }

  function ambient(state) {
    var A = byName[ui.a], B = byName[ui.b], t;
    if (state === C.DIST || state === C.CLINCH) {
      var pa = strikeRate(A.rates, B.rates, 'stand'), pb = strikeRate(B.rates, A.rates, 'stand');
      var order = rand() < 0.5 ? [['A', pa], ['B', pb]] : [['B', pb], ['A', pa]];
      var acted = false;
      order.forEach(function (o, i) {
        if (acted) return;
        var u = rand();
        if (u < o[1]) { acted = true; later(i * 80, function () { strike(o[0], state, true); }); }
        else if (u < o[1] + 0.22) { acted = true; later(i * 80, function () { strike(o[0], state, false); }); }
      });
      if (!acted && state === C.DIST) placeFor(C.DIST, STEP_MS * 0.9);
      if (state === C.DIST) setPhase('Trading at range');
      else setPhase('Clinch against the fence');
    } else {
      var top = state === C.A_TOP ? 'A' : 'B';
      var T = top === 'A' ? A : B, Bt = top === 'A' ? B : A;
      var p = strikeRate(T.rates, Bt.rates, 'ground');
      if (rand() < p * 1.6) groundStrike(top);
      else if (rand() < 0.55) groundWork(top);
      setPhase(last(T.name) + ' in control on top');
    }
  }

  function strike(who, state, landed) {
    var me = who === 'A' ? figA : figB, them = who === 'A' ? figB : figA;
    var t = now(), base = state === C.CLINCH ? 'clinch' : 'stance';
    var move;
    if (state === C.CLINCH) move = rand() < 0.6 ? 'knee' : 'cross';
    else {
      var u = rand();
      move = u < 0.38 ? 'jab' : u < 0.64 ? 'cross' : u < 0.78 ? 'hook' : u < 0.9 ? 'overhand' : 'kick';
    }
    var dir = who === 'A' ? 1 : -1;
    var lunge = state === C.CLINCH ? 0 : ({ jab: 22, cross: 28, hook: 18, overhand: 24, kick: 12 }[move] || 22);
    var meX = state === C.CLINCH ? -dir * X_CLINCH : -dir * X_DIST + dir * lunge;
    var punchMs = { jab: 130, cross: 160, hook: 140, overhand: 155, kick: 190, knee: 140 }[move] || 130;
    me.set(move, dur(punchMs), meX, t);
    later(punchMs + 30, function () {
      me.set(base, dur(180), state === C.DIST ? -dir * X_DIST : undefined, now());
    });
    if (landed) {
      var atk = byName[who === 'A' ? ui.a : ui.b], def = byName[who === 'A' ? ui.b : ui.a];
      hurt(who === 'A' ? 'B' : 'A', hitDamage(atk, def, move));
      later(Math.round(punchMs * 0.7), function () {
        them.set(state === C.CLINCH ? 'clinchHit' : 'hit', dur(90), state === C.DIST ? dir * (X_DIST + 10) : undefined, now());
      });
      later(punchMs + 120, function () { them.set(base, dur(200), state === C.DIST ? dir * X_DIST : undefined, now()); });
      if (state === C.DIST && rand() < 0.08) tick(last(byName[who === 'A' ? ui.a : ui.b].name) + (move === 'kick' ? ' lands a big kick' : ' cracks him clean'));
    }
  }

  function groundStrike(top) {
    var me = top === 'A' ? figA : figB, them = top === 'A' ? figB : figA;
    var atk = byName[top === 'A' ? ui.a : ui.b], def = byName[top === 'A' ? ui.b : ui.a];
    var d = top === 'A' ? 1 : -1;
    var shift = (rand() - 0.5) * 10;
    hurt(top === 'A' ? 'B' : 'A', hitDamage(atk, def, 'ground'));
    me.set('topRaise', dur(120), -d * X_GROUND + shift, now());
    them.set('bottomFrame', dur(100), d * X_GROUND + shift, now());
    later(130, function () {
      me.set('topPunch', dur(90), -d * (X_GROUND - 2) + shift, now());
      them.set('bottomHit', dur(90), d * X_GROUND + shift, now());
    });
    later(260, function () {
      if (rand() < 0.45) {
        me.set('topRaise', dur(90), undefined, now());
        later(100, function () {
          me.set('topPunch', dur(80), undefined, now());
          them.set('bottomHit', dur(80), undefined, now());
          hurt(top === 'A' ? 'B' : 'A', hitDamage(atk, def, 'ground') * 0.55);
        });
        later(220, function () { me.set('top', dur(160), -d * X_GROUND, now()); them.set('bottom', dur(160), d * X_GROUND, now()); });
      } else {
        me.set('top', dur(160), -d * X_GROUND, now());
        them.set('bottom', dur(160), d * X_GROUND, now());
      }
    });
  }

  function groundWork(top) {
    var me = top === 'A' ? figA : figB, them = top === 'A' ? figB : figA;
    var d = top === 'A' ? 1 : -1;
    var u = rand();
    if (u < 0.34) {
      them.set('bottomShrimp', dur(200), d * (X_GROUND + 10), now());
      me.set('topPosture', dur(200), -d * (X_GROUND + 4), now());
      later(240, function () {
        them.set('bottom', dur(220), d * X_GROUND, now());
        me.set('top', dur(220), -d * X_GROUND, now());
      });
    } else if (u < 0.68) {
      me.set('topPosture', dur(200), -d * (X_GROUND + 6), now());
      them.set('bottomFrame', dur(200), d * X_GROUND, now());
      later(240, function () {
        me.set('top', dur(200), -d * X_GROUND, now());
        them.set('bottom', dur(200), d * X_GROUND, now());
      });
    } else {
      var shift = (rand() - 0.5) * 18;
      me.set('top', dur(240), -d * X_GROUND + shift, now());
      them.set('bottom', dur(240), d * X_GROUND + shift, now());
    }
  }

  function transition(prev, next) {
    var A = byName[ui.a], B = byName[ui.b];
    var la = last(A.name), lb = last(B.name);
    if (next === C.CLINCH) { placeFor(C.CLINCH, 260); tick(la + ' and ' + lb + ' tie up'); setPhase('Clinch'); return 0; }
    if (next === C.DIST && prev === C.CLINCH) { placeFor(C.DIST, 300); tick('They break apart'); setPhase('Back at range'); return 0; }
    if (next === C.DIST) {
      var bottom = prev === C.A_TOP ? figB : figA, topF = prev === C.A_TOP ? figA : figB;
      bottom.set('rise', dur(200), undefined, now()); topF.set('rise', dur(200), undefined, now());
      later(220, function () { placeFor(C.DIST, 260); });
      tick((prev === C.A_TOP ? lb : la) + ' gets back to the feet');
      setPhase('Back on the feet');
      return 200;
    }
    if (next === C.A_TOP || next === C.B_TOP) {
      var who = next === C.A_TOP ? 'A' : 'B';
      var name = who === 'A' ? la : lb;
      if (prev === C.A_TOP || prev === C.B_TOP) {
        placeFor(next, 360);
        tick('Sweep! ' + name + ' reverses to the top', 'hot');
        flash('SWEEP', who === 'A' ? 'fa' : 'fb');
        return 220;
      }
      var shooter = who === 'A' ? figA : figB, d = who === 'A' ? 1 : -1;
      shooter.set('shot', dur(160), -d * 26, now());
      later(190, function () { placeFor(next, 260); });
      tick(name + (prev === C.CLINCH ? ' drags it to the mat' : ' shoots and lands the takedown'), 'hot');
      flash('TAKEDOWN', who === 'A' ? 'fa' : 'fb');
      return 260;
    }
    finish(prev, next);
    return 0;
  }

  function finish(prev, next) {
    var aWins = next === C.A_KO || next === C.A_SUB;
    var ko = next === C.A_KO || next === C.B_KO;
    var W = aWins ? figA : figB, Lf = aWins ? figB : figA;
    var wn = byName[aWins ? ui.a : ui.b], ln = byName[aWins ? ui.b : ui.a];
    var dir = aWins ? 1 : -1;
    var winnerTop = (prev === C.A_TOP && aWins) || (prev === C.B_TOP && !aWins);
    var ground = prev === C.A_TOP || prev === C.B_TOP;
    var how;
    queue = [];
    sim.done = true; sim.playing = false; sim.winner = aWins ? 'A' : 'B'; sim.method = ko ? 'KO' : 'SUB';
    var loser = aWins ? 'B' : 'A';
    if (ko && !ground) {
      how = 'KO';
      hurt(loser, 22);
      W.set(rand() < 0.3 ? 'kick' : 'cross', dur(150), -dir * 22, now());
      later(110, function () { Lf.set('hit', dur(90), undefined, now()); });
      later(220, function () { Lf.set('down', dur(420), dir * 64, now()); W.set('stance', dur(200), -dir * 10, now()); setHp(loser, 0); });
      later(520, function () { flash('KNOCKOUT', 'fk'); });
      tick(last(wn.name) + ' drops ' + last(ln.name) + '. It is all over!', 'end');
    } else if (ko) {
      how = 'TKO';
      for (var i = 0; i < 4; i++) (function (k) {
        later(k * 210, function () { W.set('topRaise', dur(90), undefined, now()); hurt(loser, 8); });
        later(k * 210 + 100, function () { W.set('topPunch', dur(70), undefined, now()); Lf.set('bottomHit', dur(70), undefined, now()); });
      })(i);
      later(900, function () { flash('TKO', 'fk'); Lf.set('down', dur(300), undefined, now()); setHp(loser, 0); });
      tick('Ground strikes! The referee waves it off', 'end');
    } else {
      how = 'Submission';
      var drain = Math.max(18, sim.hp[loser] * 0.35);
      if (winnerTop) {
        W.set('topSub', dur(260), undefined, now());
        for (var j = 0; j < 3; j++) (function (k) {
          later(320 + k * 200, function () { Lf.set('bottomTap', dur(90), undefined, now()); hurt(loser, drain / 3); });
          later(420 + k * 200, function () { Lf.set('bottom', dur(90), undefined, now()); });
        })(j);
      } else if (ground) {
        Lf.set('topSub', dur(260), undefined, now());
        later(260, function () { hurt(loser, drain); });
        tick(last(wn.name) + ' locks it up from the bottom');
      } else {
        W.set('shot', dur(160), -dir * 20, now());
        later(200, function () { W.set('topSub', dur(240), -dir * X_GROUND, now()); Lf.set('bottom', dur(240), dir * X_GROUND, now()); hurt(loser, drain * 0.5); });
        later(560, function () { Lf.set('bottomTap', dur(90), undefined, now()); hurt(loser, drain * 0.5); });
      }
      later(900, function () { flash('TAP!', 'fk'); setHp(loser, 0); });
      tick(last(ln.name) + ' taps!', 'end');
    }
    var round = Math.floor((sim.t - 1) / data.league.steps_per_round) + 1;
    var secs = ((sim.t - 1) % data.league.steps_per_round + 1) * data.league.dt_sec;
    later(1500, function () {
      W.set('win', dur(400), -dir * 30, now());
      if (!ko && !ground) Lf.set('down', dur(400), undefined, now());
      showResult(wn, how, 'Round ' + round + ', ' + Math.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2));
    });
    setPhase(how === 'Submission' ? 'Submission!' : how === 'TKO' ? 'Stoppage!' : 'Knockout!');
    $('btn-play').textContent = 'Fight again';
  }

  function decision() {
    queue = [];
    sim.done = true; sim.playing = false;
    var aWins = rand() < ui.pred.judgesA;
    sim.winner = aWins ? 'A' : 'B'; sim.method = 'DEC';
    var wn = byName[aWins ? ui.a : ui.b];
    setPhase('Final horn');
    tick('That is the final horn. We go to the judges', 'end');
    var t = now();
    figA.set('rest', dur(400), -40, t); figB.set('rest', dur(400), 40, t);
    flash('TO THE JUDGES');
    updateLive();
    later(1700, function () {
      (aWins ? figA : figB).set('win', dur(400), undefined, now());
      showResult(wn, 'Decision', 'After ' + ui.rounds + ' rounds');
    });
    $('btn-play').textContent = 'Fight again';
  }

  function roundBreak(nextRound) {
    queue = [];
    var t = now();
    figA.set('rest', dur(500), -X_CORNER, t); figB.set('rest', dur(500), X_CORNER, t);
    setPhase('Between rounds');
    tick('End of round ' + (nextRound - 1));
    setHp('A', sim.hp.A + 4 + rand() * 4, { snap: true });
    setHp('B', sim.hp.B + 4 + rand() * 4, { snap: true });
    flash('ROUND ' + nextRound);
    sim.state = C.DIST;
    updateLive();
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!sim.playing) return;
      placeFor(C.DIST, 400);
      tick('Round ' + nextRound + '. Fight!', '', 'R' + nextRound + ' 0:00');
      setClock();
      schedule(300);
    }, dur(1800));
  }

  function showResult(wn, how, when) {
    updateLive();
    $('result-kicker').textContent = 'Winner';
    setFace('result-face', wn);
    $('result-title').textContent = wn.name;
    $('result-detail').textContent = how + ' · ' + when;
    $('result').className = 'result ' + (wn.name === ui.a ? 'win-a' : 'win-b');
    $('result').hidden = false;
    if (lastFight) {
      lastFight.result = { winner: wn.name, how: how, when: when, side: wn.name === ui.a ? 'a' : 'b', hp: { a: sim.hp.A, b: sim.hp.B } };
      showLastFight();
    }
  }

  function lastHpHtml(A, B, hp) {
    if (!hp) return '';
    function row(name, v, side) {
      var cls = v <= 30 ? ' low' : v <= 60 ? ' mid' : '';
      return '<div class="last-hp-row side-' + side + '"><span>' + esc(name) + '</span>' +
        '<div class="hp"><div class="hp-track"><div class="hp-fill' + cls + '" style="width:' + Math.max(0, v) + '%"></div><div class="hp-ticks"></div></div>' +
        '<span class="hp-val">' + Math.round(v) + '</span></div></div>';
    }
    return '<div class="last-hp">' + row(A.name, hp.a, 'a') + row(B.name, hp.b, 'b') + '</div>';
  }

  function hideLastFight() { $('last-fight').hidden = true; }

  function showLastFight() {
    var A = byName[lastFight.a], B = byName[lastFight.b], r = lastFight.result;
    $('last-fight').hidden = false;
    $('last-title').textContent = A.name + ' vs ' + B.name;
    $('last-lede').textContent = r.how + ' · ' + r.when + '. The same night, play by play.';
    $('last-card').className = 'last-card win-' + r.side;
    $('last-card').innerHTML = face(byName[r.winner], 'face-lg') + '<p class="kicker">Winner</p><h3>' + esc(r.winner) + '</h3><p>' + esc(r.how) + ' · ' + esc(r.when) + '</p>' + lastHpHtml(A, B, r.hp);
    renderLastLog();
  }

  function renderLastLog() {
    if (!lastFight) return;
    $('last-log').innerHTML = lastFight.events.map(function (e) {
      return '<li class="' + e.cls + '"><time>' + esc(e.stamp) + '</time><span>' + esc(e.text) + '</span></li>';
    }).join('');
    var box = $('last-log');
    box.scrollTop = box.scrollHeight;
  }

  // ---------- matchmaker ----------
  function initMatchmaker() {
    var divs = DIVISIONS.filter(function (d) { return (data.matchups[d] || []).length; });
    $('mm-divisions').innerHTML = divs.map(function (d, i) { return '<button type="button" class="chip' + (i === 0 ? ' is-on' : '') + '" data-div="' + esc(d) + '">' + esc(d) + '</button>'; }).join('');
    $('mm-divisions').addEventListener('click', function (e) {
      var b = e.target.closest('[data-div]');
      if (!b) return;
      document.querySelectorAll('#mm-divisions .chip').forEach(function (c) { c.classList.toggle('is-on', c === b); });
      renderCards(b.dataset.div);
    });
    $('mm-grid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-a]');
      if (!card) return;
      setMatchup(card.dataset.a, card.dataset.b);
      document.getElementById('arena').scrollIntoView({ behavior: 'smooth' });
      setTimeout(play, 700);
    });
    renderCards(divs[0]);
  }

  function renderCards(div) {
    $('mm-grid').innerHTML = (data.matchups[div] || []).map(function (m, i) {
      var A = byName[m.a], B = byName[m.b];
      var tags = [];
      if (i === 0) tags.push('<span class="tag tag-top">Best fight to make</span>');
      if (m.stakes > 0.75) tags.push('<span class="tag">Title picture</span>');
      if (m.competitive > 0.95) tags.push('<span class="tag">Pick&rsquo;em</span>');
      if (m.finish > 0.6) tags.push('<span class="tag">Won&rsquo;t see the cards</span>');
      if (m.rematch) tags.push('<span class="tag tag-quiet">Rematch</span>');
      return '<button type="button" class="mm-card" data-a="' + esc(m.a) + '" data-b="' + esc(m.b) + '">' +
        '<div class="mm-tags">' + tags.join('') + '</div>' +
        '<div class="mm-faces">' + face(A) + face(B) + '</div>' +
        '<div class="mm-names"><span class="mm-a">' + esc(m.a) + '<small>' + A.record[0] + '-' + A.record[1] + '</small></span><em>vs</em><span class="mm-b">' + esc(m.b) + '<small>' + B.record[0] + '-' + B.record[1] + '</small></span></div>' +
        '<div class="mm-split"><div style="width:' + (m.p_a * 100) + '%"></div></div>' +
        '<div class="mm-meters">' +
        meter('Closeness', m.competitive) + meter('Finish chance', m.finish) + meter('Stakes', m.stakes) +
        '</div><span class="mm-watch">Watch it &rarr;</span></button>';
    }).join('');
  }

  function meter(label, v) {
    return '<div class="meter"><span>' + label + '</span><div><i style="width:' + Math.round(v * 100) + '%"></i></div></div>';
  }

  // ---------- track record ----------
  function renderRecord() {
    var bt = data.backtest;
    $('record-lede').textContent = 'Fighter profiles were frozen at the start of 2025, then every UFC fight since (' + bt.n + ' of them, through ' + niceDate(bt.through) + ') was called blind.';
    var tiles = [
      [pct(bt.model.accuracy), 'of winners picked correctly', 'A ratings-only baseline managed ' + pct(bt.elo.accuracy) + '.'],
      [pct(bt.finish_rate.predicted), 'of fights predicted to end early', 'The real number was ' + pct(bt.finish_rate.actual) + '.'],
      [bt.title_fights.filter(called).length + ' / ' + bt.title_fights.length, 'recent title fights called', 'Listed on the right.']
    ];
    $('record-tiles').innerHTML = tiles.map(function (t) { return '<div class="tile"><strong>' + t[0] + '</strong><span>' + t[1] + '</span><small>' + t[2] + '</small></div>'; }).join('');
    renderCalibration(bt.calibration);
    $('titles').innerHTML = bt.title_fights.map(function (f) {
      var favA = f.p_model >= 0.5, fav = favA ? f.a : f.b, p = favA ? f.p_model : 1 - f.p_model;
      var winner = f.won ? f.a : f.b;
      return '<li class="' + (called(f) ? 'hit' : 'miss') + '"><span class="t-mark">' + (called(f) ? '&#10003;' : '&#10007;') + '</span>' +
        '<div><strong>' + esc(f.a) + ' vs ' + esc(f.b) + '</strong><small>' + esc(f.division) + ' &middot; ' + niceDate(f.date) + '</small></div>' +
        '<div class="t-call">Picked ' + esc(last(fav)) + ' ' + pct(p) + '<small>' + esc(last(winner)) + ' won' + (f.kind === 'DEC' ? ' on the cards' : f.kind === 'KO' ? ' by KO' : f.kind === 'SUB' ? ' by submission' : '') + '</small></div></li>';
    }).join('');
  }

  function called(f) { return (f.p_model >= 0.5) === f.won; }

  function niceDate(s) {
    var d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderCalibration(rows) {
    var W = 320, H = 220, pad = 34;
    function x(v) { return pad + (v - 0.45) / 0.4 * (W - pad - 10); }
    function y(v) { return H - pad - (v - 0.45) / 0.4 * (H - pad - 10); }
    var maxN = Math.max.apply(null, rows.map(function (r) { return r.n; }));
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="calib">' +
      '<line class="cal-diag" x1="' + x(0.45) + '" y1="' + y(0.45) + '" x2="' + x(0.85) + '" y2="' + y(0.85) + '"/>' +
      [0.5, 0.6, 0.7, 0.8].map(function (v) {
        return '<text x="' + x(v) + '" y="' + (H - pad + 16) + '" text-anchor="middle">' + pct(v) + '</text>' +
          '<text x="' + (pad - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + pct(v) + '</text>';
      }).join('') +
      '<text x="' + (W / 2 + 10) + '" y="' + (H - 2) + '" text-anchor="middle" class="cal-axis">FightChains said</text>' +
      '<text x="10" y="' + (H / 2) + '" text-anchor="middle" class="cal-axis" transform="rotate(-90 10 ' + (H / 2) + ')">They actually won</text>' +
      rows.map(function (r) {
        return '<circle class="cal-dot" cx="' + x(r.predicted) + '" cy="' + y(r.actual) + '" r="' + (4 + 10 * Math.sqrt(r.n / maxN)) + '"><title>' +
          pct(r.lo) + '-' + pct(r.hi) + ': won ' + pct(r.actual) + ' of ' + r.n + ' fights</title></circle>';
      }).join('') + '</svg>';
    $('calib').innerHTML = svg + '<p class="note">Each bubble is a group of favourites; bigger bubbles hold more fights. On the dashed line, the chances given matched how often they won.</p>';
  }

  // ---------- hero ----------
  function renderHero() {
    var L = data.league;
    $('hero-stats').innerHTML = [
      [L.fights.toLocaleString(), 'UFC fights studied'],
      [L.fighters_active, 'active fighters modelled'],
      [niceDate(L.through), 'latest event included']
    ].map(function (s) { return '<div><strong>' + s[0] + '</strong><span>' + s[1] + '</span></div>'; }).join('');
    $('foot-through').textContent = 'Includes events through ' + niceDate(L.through) + '.';
  }

  load().then(function () {
    data.photos = data.photos || {};
    data.fighters.forEach(function (f) {
      if (!f.photo && data.photos[f.name] && data.photos[f.name].url) f.photo = data.photos[f.name].url;
      byName[f.name] = f;
    });
    renderHero();
    buildArena();
    initPickers();
    initMatchmaker();
    renderRecord();
    var best = null;
    Object.keys(data.matchups).forEach(function (d) {
      (data.matchups[d] || []).slice(0, 1).forEach(function (m) { if (!best || m.score > best.score) best = m; });
    });
    setMatchup(best.a, best.b);
    requestAnimationFrame(loop);
  }).catch(function (err) {
    document.querySelector('.hero-lede').textContent = 'Could not load fight data. Serve this folder over http (for example, python -m http.server).';
    console.error(err);
  });
})();
