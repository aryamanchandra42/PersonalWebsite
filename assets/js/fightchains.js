(function () {
  'use strict';

  var M = window.FightChainsModel;
  if (!M || !document.getElementById('fcGraph')) return;

  var D = M.D, C = M.C, SC = M.SC, AT = M.AT, AM = M.AM, BT = M.BT, BM = M.BM, AF = M.AF, BF = M.BF;
  var NT = M.NT, NS = M.NS, SPR = M.SPR, STEP_SECONDS = M.STEP_SECONDS;
  var NODE_R = 31;
  var INK = '#3a3d38', BLUE = '#486b86', RED = '#a45749', SAND = '#cfc9b8';

  var STATES = [
    { id: 'D', name: 'Distance', label: 'Distance', x: 90, y: 210, color: '#9a9c92' },
    { id: 'C', name: 'Clinch', label: 'Clinch', x: 240, y: 210, color: '#b8a27a' },
    { id: 'S', name: 'Scramble', label: 'Scramble', x: 390, y: 210, color: '#c9a95c' },
    { id: 'AT', name: 'A on top', label: 'A top', x: 390, y: 72, color: '#7f9bb3' },
    { id: 'AM', name: 'A dominant (mount / back)', label: 'A mount', x: 545, y: 72, color: '#486b86' },
    { id: 'BT', name: 'B on top', label: 'B top', x: 390, y: 348, color: '#c48b7f' },
    { id: 'BM', name: 'B dominant (mount / back)', label: 'B mount', x: 545, y: 348, color: '#a45749' },
    { id: 'AF', name: 'A finishes', label: 'A wins', x: 695, y: 72, color: '#2f4e66' },
    { id: 'BF', name: 'B finishes', label: 'B wins', x: 695, y: 348, color: '#7d3b30' }
  ];
  var PHRASES = ['at distance', 'in the clinch', 'in a scramble', 'with A on top', 'with A in mount or on the back', 'with B on top', 'with B in mount or on the back'];
  var LANES = [AF, AM, AT, C, D, SC, BT, BM, BF];

  var ATTRS = [['striking', 'Striking'], ['wrestling', 'Wrestling'], ['grappling', 'Grappling'], ['cardio', 'Cardio']];
  var PRESETS = {
    wrestler: { name: 'Pressure wrestler', striking: 45, wrestling: 90, grappling: 70, cardio: 85 },
    striker: { name: 'Counter-striker', striking: 90, wrestling: 35, grappling: 30, cardio: 60 },
    submission: { name: 'Submission specialist', striking: 40, wrestling: 55, grappling: 95, cardio: 60 },
    balanced: { name: 'Well-rounded', striking: 60, wrestling: 60, grappling: 60, cardio: 60 }
  };
  var ACTIONS = {
    stand: [['jab', 'striking'], ['leg kick', 'striking'], ['combination', 'striking'], ['feint', 'striking'], ['level change', 'wrestling']],
    clinch: [['knee', 'striking'], ['underhook', 'wrestling'], ['cage control', 'wrestling'], ['dirty boxing', 'striking'], ['trip attempt', 'wrestling']],
    scramble: [['single-leg shot', 'wrestling'], ['sprawl', 'wrestling'], ['reversal', 'grappling'], ['whizzer', 'wrestling'], ['back-take attempt', 'grappling']],
    top: [['ground and pound', 'striking'], ['guard pass', 'grappling'], ['posture up', 'wrestling'], ['elbows', 'striking'], ['half-guard smash', 'grappling']],
    dom: [['mount strikes', 'striking'], ['back take', 'grappling'], ['arm-triangle attempt', 'grappling'], ['rear-naked choke attempt', 'grappling'], ['body-lock ride', 'wrestling']]
  };
  var PARAM_LABELS = {
    stand: 'Standing finish rate', top: 'Top-control finish rate', dom: 'Mount finish rate',
    spread: 'Skill mismatch', toughness: 'Durability spread', fatigue: 'Fatigue'
  };

  var $ = function (id) { return document.getElementById(id); };
  var fighters = {
    A: Object.assign({ preset: 'wrestler' }, PRESETS.wrestler),
    B: Object.assign({ preset: 'striker' }, PRESETS.striker)
  };
  var settings = { rounds: 3, fatigue: 0.6, clock: 0, threshold: 0.5, heat: 'A', selected: D };
  var CAL = Object.assign({}, M.FITTED);
  var model = null;

  // ---------- Model glue ----------

  function params(f) {
    return { striking: f.striking / 100, wrestling: f.wrestling / 100, grappling: f.grappling / 100, cardio: f.cardio / 100 };
  }

  function invert(A) {
    var n = A.length;
    var X = A.map(function (row, i) { var id = new Array(n).fill(0); id[i] = 1; return row.slice().concat(id); });
    for (var col = 0; col < n; col++) {
      var pivot = col;
      for (var r = col + 1; r < n; r++) if (Math.abs(X[r][col]) > Math.abs(X[pivot][col])) pivot = r;
      var tmp = X[col]; X[col] = X[pivot]; X[pivot] = tmp;
      var pv = X[col][col];
      for (var k = 0; k < 2 * n; k++) X[col][k] /= pv;
      for (r = 0; r < n; r++) {
        if (r === col || !X[r][col]) continue;
        var factor = X[r][col];
        for (k = 0; k < 2 * n; k++) X[r][k] -= factor * X[col][k];
      }
    }
    return X.map(function (row) { return row.slice(n); });
  }

  function analyse(P) {
    var IQ = [];
    for (var i = 0; i < NT; i++) {
      IQ.push([]);
      for (var j = 0; j < NT; j++) IQ[i].push((i === j ? 1 : 0) - P[i][j]);
    }
    var N = invert(IQ), rows = [];
    for (i = 0; i < NT; i++) {
      var pA = 0, pB = 0, steps = 0, H = 0;
      for (var k = 0; k < NT; k++) { pA += N[i][k] * P[k][AF]; pB += N[i][k] * P[k][BF]; steps += N[i][k]; }
      for (j = 0; j < NS; j++) if (P[i][j] > 0) H -= P[i][j] * Math.log2(P[i][j]);
      rows.push({ pA: pA, pB: pB, steps: steps, entropy: H });
    }
    var pi = new Array(NT).fill(1 / NT);
    for (var it = 0; it < 600; it++) {
      var next = new Array(NT).fill(0);
      for (i = 0; i < NT; i++) for (j = 0; j < NT; j++) next[j] += pi[i] * P[i][j];
      var s = next.reduce(function (acc, v) { return acc + v; }, 0);
      pi = next.map(function (v) { return v / s; });
    }
    var rate = 0;
    rows.forEach(function (row, idx) { row.share = pi[idx]; rate += pi[idx] * row.entropy; });
    return { rows: rows, entropyRate: rate };
  }

  function backward(mats, T, target) {
    var V = new Array(T + 1);
    V[T] = new Array(NS).fill(0);
    V[T][target] = 1;
    for (var t = T - 1; t >= 0; t--) {
      var next = V[t + 1];
      if ((t + 1) % SPR === 0 && t + 1 < T) next = next.map(function (v, y) { return y < NT ? V[t + 1][D] : v; });
      var P = mats[t], cur = new Array(NS).fill(0);
      for (var x = 0; x < NS; x++) {
        var acc = 0;
        for (var y = 0; y < NS; y++) acc += P[x][y] * next[y];
        cur[x] = acc;
      }
      V[t] = cur;
    }
    return V;
  }

  function recompute() {
    var T = settings.rounds * SPR, pa = params(fighters.A), pb = params(fighters.B);
    var mats = [], subs = [];
    for (var t = 0; t < T; t++) {
      var m = M.buildMatrix(pa, pb, t, settings.fatigue, CAL);
      mats.push(m.P); subs.push(m.sub);
    }
    var cumul = mats.map(function (P) {
      return P.map(function (row) { var c = 0; return row.map(function (v) { c += v; return c; }); });
    });
    model = { T: T, mats: mats, subs: subs, cumul: cumul, analysis: analyse(mats[0]), VA: backward(mats, T, AF), VB: backward(mats, T, BF) };
  }

  // ---------- Helpers ----------

  function pct(v, digits) { return (v * 100).toFixed(digits == null ? 0 : digits) + '%'; }
  function clockLabel(t) {
    var secs = (t % SPR) * STEP_SECONDS;
    return 'R' + (Math.floor(t / SPR) + 1) + ' · ' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  }
  function endLabel(t) {
    var secs = (t % SPR + 1) * STEP_SECONDS;
    return 'round ' + (Math.floor(t / SPR) + 1) + ', ' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- Controls ----------

  function buildFighterControls() {
    var host = $('fcFighters');
    ['A', 'B'].forEach(function (key) {
      var box = el('div', { 'class': 'fc-fighter fc-fighter-' + key.toLowerCase() });
      var head = el('div', { 'class': 'fc-fighter-head' });
      head.appendChild(el('span', { 'class': 'fc-swatch', 'aria-hidden': 'true' }));
      head.appendChild(el('strong', null, 'Fighter ' + key));
      var select = el('select', { 'aria-label': 'Fighter ' + key + ' style preset' });
      Object.keys(PRESETS).forEach(function (pk) {
        var opt = el('option', { value: pk }, PRESETS[pk].name);
        if (fighters[key].preset === pk) opt.selected = true;
        select.appendChild(opt);
      });
      select.appendChild(el('option', { value: 'custom' }, 'Custom'));
      head.appendChild(select);
      box.appendChild(head);

      var inputs = {};
      ATTRS.forEach(function (attr) {
        var label = el('label', { 'class': 'fc-slider' });
        label.appendChild(el('span', null, attr[1]));
        var input = el('input', { type: 'range', min: '0', max: '100', value: String(fighters[key][attr[0]]) });
        var out = el('output', null, String(fighters[key][attr[0]]));
        input.addEventListener('input', function () {
          fighters[key][attr[0]] = Number(input.value);
          out.textContent = input.value;
          fighters[key].preset = 'custom';
          select.value = 'custom';
          schedule();
        });
        inputs[attr[0]] = { input: input, out: out };
        label.appendChild(input);
        label.appendChild(out);
        box.appendChild(label);
      });
      select.addEventListener('change', function () {
        var preset = PRESETS[select.value];
        fighters[key].preset = select.value;
        if (!preset) return;
        ATTRS.forEach(function (attr) {
          fighters[key][attr[0]] = preset[attr[0]];
          inputs[attr[0]].input.value = preset[attr[0]];
          inputs[attr[0]].out.textContent = preset[attr[0]];
        });
        schedule();
      });
      host.appendChild(box);
    });
  }

  function bindGlobals() {
    $('fcRounds').addEventListener('change', function (e) {
      settings.rounds = Number(e.target.value);
      $('fcClock').max = String(settings.rounds * SPR - 1);
      settings.clock = Math.min(settings.clock, settings.rounds * SPR - 1);
      $('fcClock').value = settings.clock;
      schedule();
    });
    $('fcFatigue').addEventListener('input', function (e) {
      settings.fatigue = Number(e.target.value) / 100;
      $('fcFatigueOut').textContent = settings.fatigue.toFixed(2);
      schedule();
    });
    $('fcClock').addEventListener('input', function (e) {
      settings.clock = Number(e.target.value);
      renderGraph();
      renderMatrix();
    });
    $('fcThreshold').addEventListener('input', function (e) {
      settings.threshold = Number(e.target.value) / 100;
      $('fcThresholdOut').textContent = e.target.value + '%';
      renderHeatmap();
    });
    document.querySelectorAll('[data-heat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.heat = btn.getAttribute('data-heat');
        document.querySelectorAll('[data-heat]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        renderHeatmap();
      });
    });
    $('fcSimRun').addEventListener('click', renderSimulation);
    $('fcTraceRun').addEventListener('click', renderTrace);
    $('fcRefit').addEventListener('click', refit);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; renderLab(); });
  }

  // ---------- Figure 2: graph ----------

  var graph = {};
  function buildGraph() {
    var root = $('fcGraph');
    var defs = svg('defs');
    var marker = svg('marker', { id: 'fcArrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '9', markerHeight: '9', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
    marker.appendChild(svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#4d5a62' }));
    defs.appendChild(marker);
    root.appendChild(defs);

    var zones = svg('g', { 'class': 'fc-zones' });
    [['Standing', 40, 168, 410, 84], ['Fighter A in control', 340, 30, 290, 84], ['Fighter B in control', 340, 306, 290, 84]].forEach(function (z) {
      zones.appendChild(svg('rect', { x: z[1], y: z[2], width: z[3], height: z[4], rx: 14 }));
      zones.appendChild(svg('text', { x: z[1] + 10, y: z[2] + (z[2] > 200 ? z[4] + 16 : -8) }, z[0]));
    });
    root.appendChild(zones);

    graph.edges = svg('g', { 'class': 'fc-edges' });
    root.appendChild(graph.edges);
    graph.nodes = [];
    var nodeLayer = svg('g', { 'class': 'fc-nodes' });
    STATES.forEach(function (s, i) {
      var g = svg('g', { 'class': 'fc-node' + (i >= NT ? ' is-absorbing' : ''), tabindex: '0', role: 'button', 'aria-label': s.name, transform: 'translate(' + s.x + ' ' + s.y + ')' });
      g.appendChild(svg('circle', { r: NODE_R, fill: s.color }));
      if (i >= NT) g.appendChild(svg('circle', { r: NODE_R - 5, 'class': 'fc-node-ring' }));
      g.appendChild(svg('text', { y: i >= NT ? 4 : -2, 'class': 'fc-node-label' }, s.label));
      var sub = svg('text', { y: 13, 'class': 'fc-node-sub' });
      g.appendChild(sub);
      var select = function () { settings.selected = i; renderGraph(); };
      g.addEventListener('mouseenter', select);
      g.addEventListener('focus', select);
      g.addEventListener('click', select);
      nodeLayer.appendChild(g);
      graph.nodes.push({ g: g, sub: sub });
    });
    root.appendChild(nodeLayer);
  }

  function edgePath(i, j) {
    var a = STATES[i], b = STATES[j];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    var nx = -dy / len, ny = dx / len, bend = Math.min(40, 14 + len * 0.06);
    var cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    var u1x = cx - a.x, u1y = cy - a.y, l1 = Math.hypot(u1x, u1y);
    var u2x = cx - b.x, u2y = cy - b.y, l2 = Math.hypot(u2x, u2y);
    var sx = a.x + u1x / l1 * (NODE_R + 2), sy = a.y + u1y / l1 * (NODE_R + 2);
    var ex = b.x + u2x / l2 * (NODE_R + 4), ey = b.y + u2y / l2 * (NODE_R + 4);
    return 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1);
  }

  function renderGraph() {
    var t = settings.clock, P = model.mats[t], sel = settings.selected;
    $('fcClockLabel').textContent = clockLabel(t);
    graph.edges.textContent = '';
    for (var i = 0; i < NT; i++) {
      for (var j = 0; j < NS; j++) {
        var p = P[i][j];
        if (i === j || p < 0.002) continue;
        var active = i === sel;
        var path = svg('path', {
          d: edgePath(i, j),
          'class': 'fc-edge' + (active ? ' is-active' : ''),
          'stroke-width': (0.8 + 16 * p).toFixed(2),
          'stroke-opacity': (active ? 0.9 : Math.min(0.55, 0.12 + p * 2.2)).toFixed(2),
          'marker-end': 'url(#fcArrow)'
        });
        path.appendChild(svg('title', null, STATES[i].name + ' → ' + STATES[j].name + ': ' + pct(p, 1)));
        graph.edges.appendChild(path);
      }
    }
    graph.edges.querySelectorAll('.is-active').forEach(function (node) { graph.edges.appendChild(node); });
    graph.nodes.forEach(function (n, idx) {
      n.g.classList.toggle('is-selected', idx === sel);
      if (idx < NT) n.sub.textContent = 'stay ' + pct(P[idx][idx]);
    });
    renderNodeDetail(P, t);
  }

  function renderNodeDetail(P, t) {
    var box = $('fcNodeDetail'), i = settings.selected;
    box.textContent = '';
    box.appendChild(el('p', { 'class': 'eyebrow' }, 'From · ' + clockLabel(t)));
    box.appendChild(el('h4', null, STATES[i].name));
    if (i >= NT) {
      box.appendChild(el('p', null, 'Absorbing: once the fight is finished, it stays finished.'));
      return;
    }
    var list = el('ol');
    P[i].map(function (p, j) { return { p: p, j: j }; })
      .filter(function (e) { return e.p >= 0.001; })
      .sort(function (a, b) { return b.p - a.p; })
      .forEach(function (e) {
        var li = el('li');
        var bar = el('span', { 'class': 'fc-bar' });
        bar.style.setProperty('--w', Math.max(2, e.p * 100) + '%');
        bar.style.setProperty('--c', STATES[e.j].color);
        li.appendChild(el('span', { 'class': 'fc-bar-label' }, e.j === i ? 'stays' : STATES[e.j].label));
        li.appendChild(bar);
        li.appendChild(el('span', { 'class': 'fc-bar-value' }, pct(e.p, 1)));
        list.appendChild(li);
      });
    box.appendChild(list);
    var stay = P[i][i];
    box.appendChild(el('p', { 'class': 'fc-detail-note' }, 'Average stay: ' + Math.round(STEP_SECONDS / (1 - stay)) + ' seconds.'));
  }

  function renderMatrix() {
    var P = model.mats[settings.clock], table = $('fcMatrix');
    table.textContent = '';
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(el('th', { scope: 'col' }, 'from \\ to'));
    STATES.forEach(function (s) { hr.appendChild(el('th', { scope: 'col', title: s.name }, s.id)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    P.forEach(function (row, i) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row', title: STATES[i].name }, STATES[i].id));
      row.forEach(function (p) {
        var td = el('td', null, p < 0.0005 ? '·' : p.toFixed(3).replace(/^0/, ''));
        var alpha = Math.pow(p, 0.55) * 0.85;
        td.style.background = 'rgba(72,107,134,' + alpha.toFixed(3) + ')';
        if (alpha > 0.45) td.style.color = '#fff';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderAnalysis() {
    var a = model.analysis, table = $('fcAnalysis');
    table.textContent = '';
    var thead = el('thead'), hr = el('tr');
    ['Position', 'A finishes', 'B finishes', 'Time to a finish', 'Time share', 'Entropy'].forEach(function (h) {
      hr.appendChild(el('th', { scope: 'col' }, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    a.rows.forEach(function (row, i) {
      var tr = el('tr'), th = el('th', { scope: 'row' }), dot = el('span', { 'class': 'fc-dot' });
      dot.style.background = STATES[i].color;
      th.appendChild(dot);
      th.appendChild(document.createTextNode(STATES[i].name));
      tr.appendChild(th);
      var split = el('td', { 'class': 'fc-split-cell' }), bar = el('span', { 'class': 'fc-split' });
      bar.style.setProperty('--a', (row.pA * 100) + '%');
      split.appendChild(el('span', { 'class': 'fc-split-num' }, pct(row.pA)));
      split.appendChild(bar);
      tr.appendChild(split);
      tr.appendChild(el('td', null, pct(row.pB)));
      tr.appendChild(el('td', null, (row.steps * STEP_SECONDS / 60).toFixed(1) + ' min'));
      tr.appendChild(el('td', null, pct(row.share, 1)));
      tr.appendChild(el('td', null, row.entropy.toFixed(2) + ' bits'));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var tfoot = el('tfoot'), fr = el('tr');
    fr.appendChild(el('td', { colspan: '6' }, 'No clock, opening-bell matrix. Entropy rate: ' + a.entropyRate.toFixed(2) + ' bits per exchange. A + B = 100% in every row.'));
    tfoot.appendChild(fr);
    table.appendChild(tfoot);
  }

  // ---------- Figure 4: heatmap ----------

  function heatAlpha(v) { return 0.03 + 0.97 * Math.pow(Math.min(1, v), 1.2); }

  function renderHeatLegend(rgb) {
    var host = $('fcHeatLegend');
    host.textContent = '';
    host.appendChild(el('span', null, '0%'));
    var ramp = el('span', { 'class': 'fc-heat-ramp' });
    ramp.style.background = 'linear-gradient(90deg,' + [0, 0.25, 0.5, 0.75, 1].map(function (v) {
      return 'rgba(' + rgb + ',' + heatAlpha(v).toFixed(3) + ') ' + (v * 100) + '%';
    }).join(',') + ')';
    host.appendChild(ramp);
    host.appendChild(el('span', null, '100%'));
  }

  function renderHeatmap() {
    var host = $('fcHeatmap'), T = model.T;
    var V = settings.heat === 'A' ? model.VA : model.VB;
    var rgb = settings.heat === 'A' ? '72,107,134' : '164,87,73';
    host.textContent = '';
    host.style.setProperty('--cols', T);
    renderHeatLegend(rgb);
    host.appendChild(el('div', { 'class': 'fc-heat-corner' }));
    for (var r = 0; r < settings.rounds; r++) {
      var rl = el('div', { 'class': 'fc-heat-round' }, 'Round ' + (r + 1));
      rl.style.gridColumn = (2 + r * SPR) + ' / span ' + SPR;
      host.appendChild(rl);
    }
    for (var i = 0; i < NT; i++) {
      var label = el('div', { 'class': 'fc-heat-label' }, STATES[i].label);
      label.style.gridRow = String(i + 2);
      host.appendChild(label);
      for (var t = 0; t < T; t++) {
        var v = V[t][i];
        var cell = el('div', { 'class': 'fc-heat-cell' + (v >= settings.threshold ? ' is-inevitable' : '') });
        cell.style.gridRow = String(i + 2);
        cell.style.gridColumn = String(t + 2);
        cell.style.background = 'rgba(' + rgb + ',' + heatAlpha(v).toFixed(3) + ')';
        cell.dataset.state = i;
        cell.dataset.t = t;
        host.appendChild(cell);
      }
    }
    if (!host.dataset.bound) {
      host.dataset.bound = '1';
      var read = function (e) {
        var c = e.target.closest('.fc-heat-cell');
        if (!c) return;
        var VV = settings.heat === 'A' ? model.VA : model.VB;
        var si = Number(c.dataset.state), tt = Number(c.dataset.t);
        $('fcHeatReadout').textContent = clockLabel(tt) + ', ' + PHRASES[si] + ': fighter ' + settings.heat + ' finishes before the bell with probability ' + pct(VV[tt][si], 1) + '.';
      };
      host.addEventListener('mouseover', read);
      host.addEventListener('click', read);
    }
    var best = { v: -1 }, count = 0;
    for (i = 0; i < NT; i++) {
      if (V[0][i] > best.v) best = { v: V[0][i], i: i };
      for (t = 0; t < T; t++) if (V[t][i] >= settings.threshold) count++;
    }
    $('fcHeatReadout').textContent = 'At the opening bell, fighter ' + settings.heat + ' is most likely to finish ' + PHRASES[best.i] + ': ' + pct(best.v) + ' before the final bell. ' + pct(count / (NT * T)) + ' of the grid clears the ' + pct(settings.threshold) + ' threshold. Hover a cell to read it.';
  }

  // ---------- Charts ----------

  function barChart(host, cats, series, opts) {
    opts = opts || {};
    host.textContent = '';
    var W = 520, H = 230, padL = 34, padB = 34, padT = 26, padR = 8;
    var max = opts.max || Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, [])) * 1.15;
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'fc-chart-svg', role: 'img', 'aria-label': opts.label || '' });
    var plotH = H - padB - padT, plotW = W - padL - padR;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var v = max * f, y = padT + plotH * (1 - f);
      root.appendChild(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y, 'class': 'fc-grid' }));
      root.appendChild(svg('text', { x: padL - 6, y: y + 3, 'class': 'fc-axis', 'text-anchor': 'end' }, Math.round(v * 100) + '%'));
    });
    var groupW = plotW / cats.length, barW = Math.min(26, (groupW - 14) / series.length);
    cats.forEach(function (cat, ci) {
      var gx = padL + groupW * ci + (groupW - barW * series.length) / 2;
      series.forEach(function (s, si) {
        var v = s.values[ci];
        if (v == null) return;
        var h = plotH * v / max, x = gx + si * barW, y = padT + plotH - h;
        var rect = svg('rect', { x: x + 1, y: y, width: barW - 2, height: Math.max(0.5, h), fill: s.color, rx: 2 });
        rect.appendChild(svg('title', null, s.name + ' · ' + cat + ': ' + pct(v, 1)));
        root.appendChild(rect);
        if (s.label !== false) root.appendChild(svg('text', { x: x + barW / 2, y: y - 4, 'class': 'fc-bar-num', 'text-anchor': 'middle' }, Math.round(v * 100)));
      });
      root.appendChild(svg('text', { x: padL + groupW * ci + groupW / 2, y: H - padB + 17, 'class': 'fc-axis fc-axis-cat', 'text-anchor': 'middle' }, cat));
    });
    host.appendChild(root);
    var legend = el('div', { 'class': 'fc-chart-legend' });
    series.forEach(function (s) {
      var item = el('span'), sw = el('i');
      sw.style.background = s.color;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(s.name));
      legend.appendChild(item);
    });
    host.appendChild(legend);
  }

  function lineChart(host, xs, series, opts) {
    host.textContent = '';
    var W = 760, H = 250, padL = 40, padB = 32, padT = 14, padR = 120;
    var plotW = W - padL - padR, plotH = H - padT - padB, xmax = xs[xs.length - 1];
    var X = function (x) { return padL + plotW * x / xmax; };
    var Y = function (v) { return padT + plotH * (1 - v); };
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'fc-chart-svg', role: 'img', 'aria-label': opts.label });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      root.appendChild(svg('line', { x1: padL, x2: padL + plotW, y1: Y(f), y2: Y(f), 'class': 'fc-grid' }));
      root.appendChild(svg('text', { x: padL - 6, y: Y(f) + 3, 'class': 'fc-axis', 'text-anchor': 'end' }, Math.round(f * 100) + '%'));
    });
    opts.ticks.forEach(function (tk) {
      root.appendChild(svg('text', { x: X(tk[0]), y: H - 10, 'class': 'fc-axis', 'text-anchor': 'middle' }, tk[1]));
    });
    series.forEach(function (s) {
      var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      root.appendChild(svg('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2.6, 'stroke-dasharray': s.dash || '', 'stroke-linecap': 'round' }));
      var last = s.values[s.values.length - 1];
      root.appendChild(svg('circle', { cx: X(xmax), cy: Y(last), r: 3.5, fill: s.color }));
      if (s.tag) root.appendChild(svg('text', { x: X(xmax) + 8, y: Y(last) + 4 + (s.nudge || 0), 'class': 'fc-line-tag', fill: s.color }, s.tag + ' ' + pct(last)));
    });
    host.appendChild(root);
    var legend = el('div', { 'class': 'fc-chart-legend' });
    opts.legend.forEach(function (lg) {
      var item = el('span'), sw = el('i', { 'class': lg.dash ? 'is-dashed' : '' });
      sw.style.borderColor = lg.color;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(lg.name));
      legend.appendChild(item);
    });
    host.appendChild(legend);
  }

  // ---------- Figure 3: life under mount ----------

  function renderMountChart() {
    var steps = 16, starts = [0, Math.min(2 * SPR, model.T - 1)];
    var curves = starts.map(function (t0) {
      var p = new Array(NS).fill(0), fin = [0], trapped = [1];
      p[AM] = 1;
      for (var k = 0; k < steps; k++) {
        var P = model.mats[Math.min(model.T - 1, t0 + k)], np = new Array(NS).fill(0);
        for (var x = 0; x < NS; x++) {
          if (!p[x]) continue;
          for (var y = 0; y < NS; y++) np[y] += p[x] * P[x][y];
        }
        p = np;
        fin.push(p[AF]);
        trapped.push(p[AM]);
      }
      return { fin: fin, trapped: trapped };
    });
    var xs = [];
    for (var i = 0; i <= steps; i++) xs.push(i);
    var late = 'R' + (Math.floor(starts[1] / SPR) + 1);
    lineChart($('fcMountChart'), xs, [
      { values: curves[0].fin, color: BLUE, tag: 'finished', nudge: -4 },
      { values: curves[1].fin, color: BLUE, dash: '6 5', tag: late, nudge: 8 },
      { values: curves[0].trapped, color: RED, tag: 'trapped', nudge: -4 },
      { values: curves[1].trapped, color: RED, dash: '6 5', tag: late, nudge: 8 }
    ], {
      label: 'Probability of being finished or still trapped under mount over four minutes',
      ticks: [[0, '0:00'], [4, '1:00'], [8, '2:00'], [12, '3:00'], [16, '4:00']],
      legend: [
        { name: 'Finished by A', color: BLUE }, { name: 'Still trapped in mount', color: RED },
        { name: 'From the opening bell', color: INK }, { name: 'From the start of ' + late.replace('R', 'round '), color: INK, dash: true }
      ]
    });
  }

  // ---------- Figures 5–7: real data ----------

  var handCache = null;
  function renderRealData() {
    var real3 = M.REAL.threeRound, real5 = M.REAL.fiveRound, meth = M.REAL.method;
    if (!handCache) handCache = { o3: M.leagueOutcome(3, M.HAND_SET), o5: M.leagueOutcome(5, M.HAND_SET) };
    var fit3 = M.leagueOutcome(3, CAL), fit5 = M.leagueOutcome(5, CAL);
    var withDec = function (o) { return o.rounds.concat([o.dec]); };

    barChart($('fcFit3'), ['Round 1', 'Round 2', 'Round 3', 'Decision'], [
      { name: 'Real UFC', values: withDec(real3), color: INK },
      { name: 'Hand-set model', values: withDec(handCache.o3), color: SAND, label: false },
      { name: 'Fitted model', values: withDec(fit3), color: BLUE }
    ], { max: 0.6, label: 'Three-round outcomes: real versus model' });
    var miss3 = maxMiss(withDec(real3), withDec(fit3));
    $('fcFit3Cap').textContent = real3.n.toLocaleString() + ' real bouts. The fitted model\u2019s largest miss is ' + (miss3 * 100).toFixed(1) + ' percentage points, against ' + (maxMiss(withDec(real3), withDec(handCache.o3)) * 100).toFixed(1) + ' for the hand-set guess.';

    barChart($('fcFit5'), ['R1', 'R2', 'R3', 'R4', 'R5', 'Decision'], [
      { name: 'Real UFC', values: withDec(real5), color: INK },
      { name: 'Hand-set model', values: withDec(handCache.o5), color: SAND, label: false },
      { name: 'Fitted model (not trained on these)', values: withDec(fit5), color: BLUE }
    ], { max: 0.6, label: 'Five-round outcomes: real versus model prediction' });
    var miss5 = maxMiss(withDec(real5), withDec(fit5));
    $('fcFit5Cap').textContent = real5.n.toLocaleString() + ' real bouts, held out of the fit. The shape carries over, with a largest miss of ' + (miss5 * 100).toFixed(1) + ' points. The model finishes too many fights early, likely because five-round bouts are title fights and main events between closely matched fighters, while the league was fitted to typical matchups.';

    var share = function (o) { var f = o.ko + o.sub + o.dec; return [o.ko / f, o.sub / f, o.dec / f]; };
    barChart($('fcMethod'), ['KO / TKO', 'Submission', 'Decision'], [
      { name: 'Real UFC', values: [meth.ko, meth.sub, meth.dec], color: INK },
      { name: 'Hand-set model', values: share(handCache.o3), color: SAND, label: false },
      { name: 'Fitted model', values: share(fit3), color: BLUE }
    ], { max: 0.6, label: 'Finish methods: real versus model' });
    $('fcMethodCap').textContent = meth.n.toLocaleString() + ' real bouts. Knockouts come from strikes standing or on the ground, and submissions from chokes and locks in the clinch, scrambles, and on the mat.';

    $('fcStatFit').textContent = '\u00b1' + (miss3 * 100).toFixed(1) + ' pts';
    $('fcStatN3').textContent = real3.n.toLocaleString();
    $('fcStatHeld').textContent = '\u00b1' + (miss5 * 100).toFixed(1) + ' pts';
    $('fcStatN5').textContent = real5.n.toLocaleString();

    var host = $('fcParams');
    host.textContent = '';
    Object.keys(PARAM_LABELS).forEach(function (k) {
      var d = el('div');
      d.appendChild(el('strong', null, (Math.round(CAL[k] * 1000) / 1000).toString()));
      d.appendChild(el('span', null, PARAM_LABELS[k]));
      host.appendChild(d);
    });
  }

  function maxMiss(a, b) {
    var m = 0;
    for (var i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  }

  function refit() {
    var btn = $('fcRefit'), status = $('fcFitStatus');
    btn.disabled = true;
    status.textContent = 'Fitting from the hand-set starting point\u2026';
    setTimeout(function () {
      var t0 = performance.now();
      var result = M.fit();
      var secs = ((performance.now() - t0) / 1000).toFixed(1);
      var same = Object.keys(M.FITTED).every(function (k) { return Math.abs(result.cal[k] - M.FITTED[k]) < 1e-3; });
      CAL = result.cal;
      renderRealData();
      renderLab();
      status.textContent = 'Done in ' + secs + ' s. Squared error ' + result.loss.toFixed(5) + (same ? ', matching the stored fit.' : '.');
      btn.disabled = false;
    }, 30);
  }

  // ---------- Simulation ----------

  function sample(cumRow) {
    var u = Math.random();
    for (var j = 0; j < NS; j++) if (u < cumRow[j]) return j;
    return NS - 1;
  }

  function runFight(record) {
    var x = D, steps = [];
    for (var t = 0; t < model.T; t++) {
      if (t > 0 && t % SPR === 0) x = D;
      var y = sample(model.cumul[t][x]);
      if (record) steps.push({ t: t, from: x, to: y });
      if (y >= NT) {
        var winner = y === AF ? 'A' : 'B';
        var isSub = Math.random() < model.subs[t][x][winner === 'A' ? 0 : 1];
        var method = isSub ? 'submission' : (x === D || x === C ? 'knockout' : 'TKO (ground strikes)');
        return { winner: winner, t: t, from: x, method: method, steps: steps };
      }
      x = y;
    }
    return { winner: null, t: model.T - 1, steps: steps };
  }

  function renderSimulation() {
    var n = Number($('fcSimCount').value);
    var res = { A: 0, B: 0, dec: 0 };
    var byRound = { A: new Array(settings.rounds).fill(0), B: new Array(settings.rounds).fill(0) };
    var methods = { A: {}, B: {} };
    for (var k = 0; k < n; k++) {
      var f = runFight(false);
      if (!f.winner) { res.dec++; continue; }
      res[f.winner]++;
      byRound[f.winner][Math.floor(f.t / SPR)]++;
      methods[f.winner][f.method] = (methods[f.winner][f.method] || 0) + 1;
    }
    var host = $('fcSimResults');
    host.textContent = '';
    var bar = el('div', { 'class': 'fc-outcome-bar', role: 'img', 'aria-label': 'A finishes ' + pct(res.A / n, 1) + ', decision ' + pct(res.dec / n, 1) + ', B finishes ' + pct(res.B / n, 1) });
    [[res.A, BLUE], [res.dec, SAND], [res.B, RED]].forEach(function (seg) {
      var s = el('span');
      s.style.flexBasis = (seg[0] / n * 100) + '%';
      s.style.background = seg[1];
      bar.appendChild(s);
    });
    host.appendChild(bar);
    var stats = el('div', { 'class': 'fc-sim-stats' });
    var methodText = function (who) {
      return Object.keys(methods[who]).sort(function (a, b) { return methods[who][b] - methods[who][a]; })
        .map(function (m) { return m + ' ' + pct(methods[who][m] / Math.max(1, res[who])); }).join(' · ');
    };
    var roundText = function (who) {
      return byRound[who].map(function (c, r) { return 'R' + (r + 1) + ' ' + pct(c / Math.max(1, res[who])); }).join(' · ');
    };
    [['Fighter A finishes', res.A, res.A ? methodText('A') + ' | ' + roundText('A') : '', 'is-a'],
     ['Goes to decision', res.dec, 'the bell rings before any finish', 'is-dec'],
     ['Fighter B finishes', res.B, res.B ? methodText('B') + ' | ' + roundText('B') : '', 'is-b']].forEach(function (b) {
      var d = el('div', { 'class': b[3] });
      d.appendChild(el('strong', null, pct(b[1] / n, 1)));
      d.appendChild(el('span', null, b[0]));
      if (b[2]) d.appendChild(el('small', null, b[2]));
      stats.appendChild(d);
    });
    host.appendChild(stats);
    host.appendChild(el('p', { 'class': 'fc-caption' }, n.toLocaleString() + ' simulated fights. Exact values from backward recursion: A ' + pct(model.VA[0][D], 1) + ', B ' + pct(model.VB[0][D], 1) + '. Any gap is sampling noise.'));
  }

  // ---------- Figure 1: fight path ----------

  function choose(list) { return list[Math.floor(Math.random() * list.length)]; }

  function transitionAction(from, to, method) {
    var standing = from === D || from === C;
    var toTop = to === AT || to === BT;
    var fromCtrl = from === AT || from === BT || from === AM || from === BM;
    if (to === AF || to === BF) {
      if (method === 'submission') return choose(['rear-naked choke', 'arm-triangle choke', 'guillotine']);
      return standing ? choose(['knockout punch', 'head kick', 'flying knee']) : 'ground and pound stoppage';
    }
    if (from === D && toTop) return choose(['double-leg takedown', 'single-leg takedown']);
    if (from === C && toTop) return choose(['body-lock trip', 'hip toss']);
    if (from === SC && toTop) return 'wins the scramble';
    if (standing && to === SC) return 'shoots, opponent sprawls';
    if ((from === AT && to === AM) || (from === BT && to === BM)) return choose(['passes to mount', 'takes the back']);
    if ((from === AT || from === AM) && to === BT) return 'sweep';
    if ((from === BT || from === BM) && to === AT) return 'sweep';
    if (fromCtrl && to === D) return 'stands back up';
    if (fromCtrl && to === SC) return 'escape attempt';
    return null;
  }

  function pickAction(state, actorKey) {
    var bank = state === D ? ACTIONS.stand : state === C ? ACTIONS.clinch : state === SC ? ACTIONS.scramble
      : (state === AT || state === BT) ? ACTIONS.top : ACTIONS.dom;
    var f = fighters[actorKey];
    var weights = bank.map(function (a) { return 0.15 + f[a[1]] / 100; });
    var u = Math.random() * weights.reduce(function (s, w) { return s + w; }, 0);
    for (var i = 0; i < bank.length; i++) { u -= weights[i]; if (u <= 0) return bank[i][0]; }
    return bank[0][0];
  }

  function actorFor(from, to) {
    if (to === AF) return 'A';
    if (to === BF) return 'B';
    var aCtrl = from === AT || from === AM, bCtrl = from === BT || from === BM;
    if (aCtrl || bCtrl) {
      var bottomGains = (aCtrl && (to === D || to === SC || to === BT)) || (bCtrl && (to === D || to === SC || to === AT));
      return (aCtrl !== bottomGains) ? 'A' : 'B';
    }
    if (to === AT || to === AM) return 'A';
    if (to === BT || to === BM) return 'B';
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  function renderTrace() {
    var fight = runFight(true), T = model.T;
    var host = $('fcPath');
    host.textContent = '';
    var W = 900, laneH = 24, padL = 74, padT = 22, padR = 12;
    var H = padT + laneH * LANES.length + 16;
    var plotW = W - padL - padR;
    var X = function (t) { return padL + plotW * t / T; };
    var laneOf = function (s) { return LANES.indexOf(s); };
    var Y = function (s) { return padT + laneH * laneOf(s) + laneH / 2; };
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'fc-path-svg', role: 'img', 'aria-label': 'Path of one simulated fight through positions over time' });

    for (var r = 0; r < settings.rounds; r++) {
      root.appendChild(svg('rect', { x: X(r * SPR), y: padT - 4, width: X(SPR) - padL, height: laneH * LANES.length + 8, 'class': r % 2 ? 'fc-round-band is-alt' : 'fc-round-band' }));
      root.appendChild(svg('text', { x: X(r * SPR) + 6, y: padT - 8, 'class': 'fc-axis' }, 'Round ' + (r + 1)));
    }
    LANES.forEach(function (s) {
      root.appendChild(svg('line', { x1: padL, x2: W - padR, y1: Y(s), y2: Y(s), 'class': 'fc-lane' }));
      var tx = svg('text', { x: padL - 8, y: Y(s) + 4, 'class': 'fc-lane-label' + (s >= NT ? ' is-final' : ''), 'text-anchor': 'end' }, STATES[s].label);
      root.appendChild(tx);
    });

    var path = '', segs = svg('g'), hits = svg('g');
    fight.steps.forEach(function (s, i) {
      var x0 = X(s.t), x1 = X(s.t + 1), y = Y(s.from);
      path += (i === 0 ? 'M' : 'L') + x0.toFixed(1) + ',' + y.toFixed(1) + ' L' + x1.toFixed(1) + ',' + y.toFixed(1) + ' ';
      if (s.to < NT && (s.t + 1) % SPR !== 0) path += 'L' + x1.toFixed(1) + ',' + Y(s.to).toFixed(1) + ' ';
      if ((s.t + 1) % SPR === 0 && s.to < NT && i < fight.steps.length - 1) path += 'M' + x1.toFixed(1) + ',' + Y(D).toFixed(1) + ' ';
      segs.appendChild(svg('line', { x1: x0 + 1, x2: x1 - 1, y1: y, y2: y, stroke: STATES[s.from].color, 'class': 'fc-path-seg' }));
      var actor = actorFor(s.from, s.to);
      var isFinish = s.to >= NT;
      var action = transitionAction(s.from, s.to, isFinish ? fight.method : null) || pickAction(s.from, actor);
      var hit = svg('rect', { x: x0, y: padT, width: x1 - x0, height: laneH * LANES.length, 'class': 'fc-path-hit' });
      hit.appendChild(svg('title', null, clockLabel(s.t) + ' · ' + STATES[s.from].name + ' · ' + actor + ': ' + action + ' → ' + STATES[s.to].name));
      hits.appendChild(hit);
    });
    root.appendChild(svg('path', { d: path, 'class': 'fc-path-line' }));
    root.appendChild(segs);
    if (fight.winner) {
      var last = fight.steps[fight.steps.length - 1];
      var fx = X(last.t + 1), fy = Y(last.to);
      root.appendChild(svg('line', { x1: fx, x2: fx, y1: Y(last.from), y2: fy, 'class': 'fc-path-finish-line', stroke: STATES[last.to].color }));
      root.appendChild(svg('circle', { cx: fx, cy: fy, r: 7, fill: STATES[last.to].color, 'class': 'fc-path-finish' }));
      var label = svg('text', { x: fx + (fx > W - 180 ? -12 : 12), y: fy + 4, 'class': 'fc-path-finish-label', 'text-anchor': fx > W - 180 ? 'end' : 'start' }, fight.method + ', ' + endLabel(last.t));
      root.appendChild(label);
    } else {
      root.appendChild(svg('text', { x: W - padR - 4, y: Y(D) - 8, 'class': 'fc-path-finish-label', 'text-anchor': 'end' }, 'Decision'));
    }
    root.appendChild(hits);
    host.appendChild(root);

    var summary;
    if (fight.winner) summary = 'Fighter ' + fight.winner + ' wins by ' + fight.method + ' ' + PHRASES[fight.from] + ', ' + endLabel(fight.t) + '.';
    else summary = 'No finish: the fight goes the distance to the judges.';
    var visits = new Array(NT).fill(0);
    fight.steps.forEach(function (s) { visits[s.from]++; });
    var top = visits.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; })[0];
    summary += ' Most time spent ' + PHRASES[top.i] + ' (' + pct(top.v / fight.steps.length) + '). Hover the plot to see each exchange.';
    $('fcTraceSummary').textContent = summary;
    $('fcPathTitle').textContent = PRESETS[fighters.A.preset] && PRESETS[fighters.B.preset]
      ? PRESETS[fighters.A.preset].name + ' (A) vs ' + PRESETS[fighters.B.preset].name.toLowerCase() + ' (B)'
      : 'Fighter A vs fighter B';
  }

  function renderLab() {
    recompute();
    renderGraph();
    renderMatrix();
    renderAnalysis();
    renderMountChart();
    renderHeatmap();
    renderSimulation();
    renderTrace();
  }

  buildFighterControls();
  buildGraph();
  bindGlobals();
  renderLab();
  renderRealData();
})();
