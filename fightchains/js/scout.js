// Akhara to Octagon: map a discipline onto UFC cohort rates and fill the scorecard.
(function (root) {
  'use strict';

  var RATE_KEYS = [
    'td', 'td_vuln', 'clinch_share', 'top_exit', 'bottom_exit', 'rev', 'rev_vuln',
    'ko_stand', 'ko_stand_vuln', 'gnp', 'gnp_vuln', 'sub', 'sub_vuln',
    'land_stand', 'absorb_stand', 'land_ground', 'absorb_ground'
  ];
  var SKILLS = [
    { key: 'td', label: 'Takedowns', high: true },
    { key: 'td_vuln', label: 'Takedown defence', high: false },
    { key: 'land_stand', label: 'Standing strikes', high: true },
    { key: 'ko_stand', label: 'Power', high: true },
    { key: 'ko_stand_vuln', label: 'Durability', high: false },
    { key: 'top_exit', label: 'Top control', high: false },
    { key: 'sub', label: 'Submissions', high: true },
    { key: 'sub_vuln', label: 'Submission defence', high: false }
  ];
  var CAMP = [
    { key: 'td', high: true },
    { key: 'td_vuln', high: false },
    { key: 'land_stand', high: true },
    { key: 'sub_vuln', high: false },
    { key: 'ko_stand_vuln', high: false }
  ];
  var SLIDERS = [
    { id: 'td_vuln', label: 'Wrestling defence', keys: ['td_vuln'], high: false },
    { id: 'striking', label: 'Striking', keys: ['land_stand', 'ko_stand'], high: true },
    { id: 'td', label: 'Takedowns', keys: ['td'], high: true },
    { id: 'sub_vuln', label: 'Submission defence', keys: ['sub_vuln'], high: false }
  ];
  var PRIORITY = [
    { id: 'td_vuln', label: 'Wrestling defence', keys: ['td_vuln'], high: false },
    { id: 'striking', label: 'Striking', keys: ['land_stand', 'ko_stand'], high: true },
    { id: 'td', label: 'Takedowns', keys: ['td'], high: true },
    { id: 'sub_vuln', label: 'Submission defence', keys: ['sub_vuln'], high: false }
  ];

  var data, ui = { discipline: 'kushti', division: 'Featherweight', athlete: '', opponent: 'median', sliders: {} };
  var inferred = null;
  var onMatchup = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function wins1000(p) { return Math.round(p * 100) * 10; }
  function extra1000(p) { return wins1000(p) - 500; }
  function record1000(p) {
    var w = wins1000(p);
    return w + '\u2013' + (1000 - w) + ' in 1,000';
  }
  function edgePts(p) {
    var e = Math.abs(extra1000(p));
    return e % 10 === 0 ? String(e / 10) : (e / 10).toFixed(1);
  }
  function slateCopy(p, hypo) {
    var extra = extra1000(p);
    var abs = Math.abs(extra);
    var kind = extra >= 0 ? 'extra wins' : 'extra losses';
    var hypoBit = hypo ? ' With the sliders on, this is hypothetical.' : '';
    if (abs === 0) {
      return 'Even money over 1,000 fights of this matchup (500\u2013500).' + hypoBit;
    }
    return record1000(p) + ' fights of this matchup. A ' + edgePts(p) +
      '-point edge is ' + abs + ' ' + kind + ' versus a coin flip \u2014 small on a card, the whole scouting case at volume.' +
      hypoBit;
  }
  function copy(rates) {
    var o = {};
    RATE_KEYS.forEach(function (k) { o[k] = rates[k]; });
    return o;
  }

  function discById(id) {
    return data.roster.disciplines.filter(function (d) { return d.id === id; })[0];
  }
  function athleteById(id) {
    return data.roster.athletes.filter(function (a) { return a.id === id; })[0];
  }
  function pool(division) {
    var div = data.archetypes.divisions[division];
    return { div: div, sex: data.archetypes.sex[div.sex], novice: data.archetypes.novice };
  }
  function cohortOf(p, name) {
    var c = p.div.cohorts[name];
    if (c && c.rates && c.n >= 4) return c;
    return p.sex.cohorts[name];
  }

  function buildInferred(discipline, division) {
    var p = pool(division);
    var coh = cohortOf(p, discipline.cohort);
    var med = p.div.median;
    var rates = copy(coh.rates);
    (discipline.shrink || []).forEach(function (k) {
      rates[k] = mix(coh.rates[k], med[k], 0.5);
    });
    if (discipline.pin && coh.p25) rates.top_exit = Math.min(rates.top_exit, coh.p25.top_exit);
    if (discipline.lock_step && coh.p75) rates.sub = Math.min(coh.p75.sub, mix(coh.rates.sub, coh.p75.sub, 0.5));
    if (discipline.range_bias) rates.clinch_share = Math.min(rates.clinch_share, mix(coh.rates.clinch_share, med.clinch_share, 0.5));
    var notes = [];
    notes.push('Cohort: ' + coh.label + ' n=' + coh.n + ' in this pool.');
    if ((discipline.shrink || []).length) notes.push('Shrunk toward the division median because the tradition has no cage equivalent for: ' + discipline.shrink.join(', ') + '.');
    if (discipline.pin) notes.push('Kushti pins set top-exit to the wrestler cohort’s low end.');
    if (discipline.lock_step) notes.push('Kalari locks add a small submission step, capped at the striker-first 75th percentile.');
    notes.push('Indian fight results were not used to fit this map. The numbers are inferred from UFC rates.');
    return { rates: rates, pool: p, coh: coh, med: med, novice: p.novice, notes: notes, nDiv: p.div.n };
  }

  function targetValue(key, high, inferredRate, coh, med) {
    if (high) return Math.max(inferredRate, coh.rates[key], med[key]);
    return Math.min(inferredRate, coh.rates[key], med[key]);
  }

  function applySliders(base, coh, med) {
    var rates = copy(base);
    SLIDERS.forEach(function (s) {
      var t = (ui.sliders[s.id] || 0) / 100;
      if (!t) return;
      s.keys.forEach(function (k) {
        var goal = targetValue(k, s.high, base[k], coh, med);
        rates[k] = mix(base[k], goal, t);
      });
    });
    return rates;
  }

  function nudge(base, keys, high, coh, med, t) {
    var rates = copy(base);
    keys.forEach(function (k) {
      rates[k] = mix(base[k], targetValue(k, high, base[k], coh, med), t);
    });
    return rates;
  }

  function band(v, p25, p50, p75, high) {
    var a = high ? p25 : p75, b = p50, c = high ? p75 : p25;
    var x = v;
    if (!high) { a = -p75; b = -p50; c = -p25; x = -v; }
    if (c === a) return 0.5;
    if (x <= a) return 0.12;
    if (x <= b) return 0.25 + 0.25 * (x - a) / Math.max(1e-9, b - a);
    if (x <= c) return 0.5 + 0.25 * (x - b) / Math.max(1e-9, c - b);
    return 0.85;
  }

  function atLeastMedian(v, med, high) {
    return high ? v >= med : v <= med;
  }

  function styleFrom(rates) {
    var clinch = Math.min(0.35, rates.clinch_share);
    var top = Math.min(0.45, 0.12 + 0.5 * rates.td);
    var bottom = Math.min(0.2, 0.08 + 0.3 * rates.td_vuln);
    var dist = Math.max(0.15, 1 - clinch - top - bottom);
    var s = dist + clinch + top + bottom;
    return { distance: dist / s, clinch: clinch / s, top: top / s, bottom: bottom / s };
  }

  function strengthsFrom(rates, div) {
    var out = {};
    SKILLS.forEach(function (s) {
      out[s.key] = band(rates[s.key], div.p25[s.key], div.median[s.key], div.p75[s.key], s.high);
    });
    return {
      striking: out.land_stand,
      power: out.ko_stand,
      wrestling: (out.td + out.td_vuln) / 2,
      control: out.top_exit,
      submissions: out.sub,
      durability: out.ko_stand_vuln
    };
  }

  function fighter(name, nick, division, rates, extra) {
    var div = data.archetypes.divisions[division];
    return Object.assign({
      name: name,
      nickname: nick || '',
      division: division,
      record: [0, 0],
      elo: 1500,
      last: '',
      height: '',
      reach: '',
      stance: '',
      style: styleFrom(rates),
      strengths: strengthsFrom(rates, div),
      form: [],
      rates: rates,
      photo: '',
      prospect: true
    }, extra || {});
  }

  function predict(aRates, bRates) {
    return window.FightChain.predict(aRates, bRates, 3, data.league);
  }

  function currentName() {
    if (ui.athlete) {
      var a = athleteById(ui.athlete);
      if (a) return a.name;
    }
    return discById(ui.discipline).name + ' archetype';
  }

  function opponentOf(division, ratesKind) {
    var p = pool(division);
    if (ratesKind === 'novice') {
      return fighter('Novice (league rates)', 'No camp', division, copy(p.novice), { synthetic: 'novice', prospect: false });
    }
    return fighter('Typical ' + division, 'Measured median', division, copy(p.div.median), { synthetic: 'median', prospect: false });
  }

  function score(rates) {
    var d = discById(ui.discipline);
    var built = inferred;
    var vsMed = predict(rates, built.med);
    var vsNov = predict(rates, built.novice);
    var ready = CAMP.filter(function (s) {
      return atLeastMedian(rates[s.key], built.med[s.key], s.high);
    }).length;
    var skillRows = SKILLS.map(function (s) {
      var pctile = band(rates[s.key], built.pool.div.p25[s.key], built.med[s.key], built.pool.div.p75[s.key], s.high);
      var vs = atLeastMedian(rates[s.key], built.med[s.key], s.high);
      return { label: s.label, pctile: pctile, above: vs, high: s.high };
    });
    var lifts = PRIORITY.map(function (s) {
      var moved = nudge(built.rates, s.keys, s.high, built.coh, built.med, 0.5);
      var p = predict(moved, built.med).pA;
      return { id: s.id, label: s.label, p: p, gain: p - vsMed.pA };
    }).sort(function (a, b) { return b.gain - a.gain; });
    var path = vsNov.pA < 0.5 ? 'neither' : (vsMed.pA >= 0.5 ? 'median' : 'novice');
    var hypo = SLIDERS.some(function (s) { return (ui.sliders[s.id] || 0) > 0; });
    return {
      vsMed: vsMed, vsNov: vsNov, ready: ready, skillRows: skillRows, lifts: lifts, path: path,
      hypo: hypo, notes: built.notes, disc: d, coh: built.coh, nDiv: built.nDiv
    };
  }

  function renderControls() {
    var discs = data.roster.disciplines;
    $('sc-disciplines').innerHTML = discs.map(function (d) {
      return '<button type="button" class="chip' + (d.id === ui.discipline ? ' is-on' : '') + '" data-disc="' + d.id + '">' + esc(d.name) + '</button>';
    }).join('');
    var divs = Object.keys(data.archetypes.divisions);
    $('sc-division').innerHTML = divs.map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === ui.division ? ' selected' : '') + '>' + esc(d) + '</option>';
    }).join('');
    var people = data.roster.athletes.filter(function (a) { return a.discipline === ui.discipline; });
    $('sc-athlete').innerHTML = '<option value="">Unnamed ' + esc(discById(ui.discipline).name) + ' archetype</option>' +
      people.map(function (a) {
        return '<option value="' + a.id + '"' + (a.id === ui.athlete ? ' selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');
    $('sc-sliders').innerHTML = SLIDERS.map(function (s) {
      var v = ui.sliders[s.id] || 0;
      return '<label class="sc-slider"><span>' + esc(s.label) + '</span>' +
        '<input type="range" min="0" max="100" step="5" value="' + v + '" data-slider="' + s.id + '">' +
        '<em>' + v + '%</em></label>';
    }).join('');
  }

  function renderCard(s) {
    var name = currentName();
    var athlete = ui.athlete ? athleteById(ui.athlete) : null;
    var year = athlete && athlete.born ? (new Date().getFullYear() - athlete.born) + ' · born ' + athlete.born : '';
    var wt = athlete && athlete.weight_kg ? athlete.weight_kg + ' kg' : '';
    var src = athlete ? '<a href="' + esc(athlete.source) + '" target="_blank" rel="noreferrer">' + esc(athlete.source_label) + '</a>' : 'Unnamed archetype — no biography';
    $('sc-who').innerHTML =
      '<p class="kicker">MMA Transition Scorecard</p>' +
      '<h2>' + esc(name) + '</h2>' +
      '<p class="sc-meta">' + esc(s.disc.name) + ' · ' + esc(ui.division) +
      (wt ? ' · ' + wt : '') + (year ? ' · ' + year : '') +
      ' · <span class="tag-inf">inferred</span></p>' +
      '<p class="sc-src">Facts: ' + src + '. Rates are not from that page.</p>';

    $('sc-ready-val').textContent = Math.round(s.ready / CAMP.length * 100);
    $('sc-ready-note').textContent = s.ready + ' of 5 camp skills sit at or above the UFC ' + ui.division + ' median. An index, not a chance of making the UFC.';

    $('sc-p-med').textContent = pct(s.vsMed.pA);
    $('sc-p-nov').textContent = pct(s.vsNov.pA);
    $('sc-p-label').textContent = (s.hypo ? 'hypothetical · ' : '') + record1000(s.vsMed.pA);
    $('sc-p-nov-note').textContent = record1000(s.vsNov.pA) + ' · same size, no camp';
    $('sc-slate').textContent = slateCopy(s.vsMed.pA, s.hypo);

    var pathLabel = s.path === 'median' ? 'Favours a typical UFC ' + ui.division
      : s.path === 'novice' ? 'Favours a novice, not a typical UFC fighter'
      : 'Does not favour either opponent';
    $('sc-path').textContent = pathLabel;

    var split = s.vsMed.split;
    $('sc-method').innerHTML = [
      ['KO / TKO', split.aKo], ['Submission', split.aSub], ['Decision', split.aDec]
    ].map(function (row) {
      return '<li><span>' + row[0] + '</span><b>' + pct(row[1] / Math.max(1e-9, s.vsMed.pA)) + '</b></li>';
    }).join('');

    var ranked = s.skillRows.slice().sort(function (a, b) { return b.pctile - a.pctile; });
    $('sc-skills').innerHTML = ranked.map(function (row, i) {
      var kind = i < 3 ? 'strength' : 'gap';
      return '<li class="' + kind + '"><span>' + esc(row.label) + '</span>' +
        '<div class="sc-bar"><i style="width:' + Math.round(row.pctile * 100) + '%"></i></div>' +
        '<small>' + (row.above ? 'at or above median' : 'below median') + ' · inferred</small></li>';
    }).join('');

    var best = s.lifts[0];
    var liftFights = Math.round(best.gain * 1000);
    $('sc-priority').innerHTML = best.gain > 0.005
      ? '<strong>' + esc(best.label) + '</strong> is the largest lift: halfway to a competent UFC level moves the median-fight estimate from ' +
        pct(s.vsMed.pA) + ' to ' + pct(best.p) + ' \u2014 about ' + Math.abs(liftFights) + ' extra fights in 1,000.'
      : 'No single camp skill moves this card much. The foundation is already close to the median, or the missing tools are several.';
    $('sc-lifts').innerHTML = s.lifts.map(function (row) {
      var fights = Math.round(row.gain * 1000);
      var g = (row.gain >= 0 ? '+' : '\u2212') + (Math.abs(row.gain) * 100).toFixed(1) + ' pts';
      var vol = (fights >= 0 ? '+' : '\u2212') + Math.abs(fights) + ' / 1,000';
      return '<li><span>' + esc(row.label) + '</span><b>' + g + ' <em>' + vol + '</em></b></li>';
    }).join('');

    $('sc-assumptions').innerHTML = '<ul>' + s.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
      '<li>Measured: UFC cohort rates, frozen before 1 Jan 2025, ' + s.nDiv + ' fighters in ' + esc(ui.division) + '.</li>' +
      '<li>The UFC holdout on this page (495 bouts, 59.8% winner accuracy) validates the chain, not this scouting layer.</li></ul>';
    $('sc-blurb').textContent = s.disc.blurb;
    $('sc-gap').textContent = s.disc.gap;
  }

  function refresh() {
    var d = discById(ui.discipline);
    inferred = buildInferred(d, ui.division);
    var rates = applySliders(inferred.rates, inferred.coh, inferred.med);
    var s = score(rates);
    renderCard(s);
    var A = fighter(currentName(), d.name, ui.division, rates, { athleteId: ui.athlete });
    var B = opponentOf(ui.division, ui.opponent);
    if (onMatchup) onMatchup(A, B, ui.division);
  }

  function bind() {
    $('sc-disciplines').addEventListener('click', function (e) {
      var b = e.target.closest('[data-disc]');
      if (!b) return;
      ui.discipline = b.dataset.disc;
      ui.athlete = '';
      var people = data.roster.athletes.filter(function (a) { return a.discipline === ui.discipline; });
      if (people[0]) ui.division = people[0].division;
      renderControls();
      refresh();
    });
    $('sc-division').addEventListener('change', function (e) {
      ui.division = e.target.value;
      refresh();
    });
    $('sc-athlete').addEventListener('change', function (e) {
      ui.athlete = e.target.value;
      if (ui.athlete) ui.division = athleteById(ui.athlete).division;
      renderControls();
      refresh();
    });
    $('sc-sliders').addEventListener('input', function (e) {
      var el = e.target.closest('[data-slider]');
      if (!el) return;
      ui.sliders[el.dataset.slider] = +el.value;
      el.parentNode.querySelector('em').textContent = el.value + '%';
      refresh();
    });
    document.querySelectorAll('[data-opp]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.opponent = b.dataset.opp;
        document.querySelectorAll('[data-opp]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        refresh();
      });
    });
    $('sc-reset').addEventListener('click', function () {
      ui.sliders = {};
      renderControls();
      refresh();
    });
  }

  root.Akhara = {
    init: function (payload, hooks) {
      data = payload;
      onMatchup = hooks && hooks.setMatchup;
      SLIDERS.forEach(function (s) { ui.sliders[s.id] = 0; });
      renderControls();
      bind();
      refresh();
    }
  };
})(this);
