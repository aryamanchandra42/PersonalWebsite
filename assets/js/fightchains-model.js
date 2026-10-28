(function (root) {
  'use strict';

  var D = 0, C = 1, SC = 2, AT = 3, AM = 4, BT = 5, BM = 6, AF = 7, BF = 8;
  var NT = 7, NS = 9;
  var STEP_SECONDS = 15, SPR = 20;

  // Real UFC outcomes used to fit and test the model.
  var REAL = {
    threeRound: {
      label: 'UFC three-round bouts with a winner, 2016 to Oct 2026',
      n: 4812,
      rounds: [0.254, 0.162, 0.081],
      dec: 0.501,
      source: 'AgentMMA',
      url: 'https://agentmma.com/mma-lab/ufc-finishes-by-round'
    },
    fiveRound: {
      label: 'UFC five-round bouts with a winner, 2016 to Oct 2026',
      n: 521,
      rounds: [0.202, 0.163, 0.106, 0.056, 0.048],
      dec: 0.424,
      source: 'AgentMMA',
      url: 'https://agentmma.com/mma-lab/ufc-finishes-by-round'
    },
    method: {
      label: 'All UFC bouts, 1994 to Mar 2026',
      n: 8591,
      ko: 0.326,
      sub: 0.193,
      dec: 0.468,
      source: 'GrapplerHQ',
      url: 'https://www.grapplerhq.com/mma/ufc-statistics/'
    }
  };

  var HAND_SET = { stand: 0.4, top: 0.45, dom: 0.65, spread: 0.3, toughness: 0, fatigue: 0.6 };
  // Output of fit(); stored so the page does not refit on every load.
  var FITTED = { stand: 0.3564, top: 0.07605, dom: 0.585, spread: 0.1, toughness: 1.5, fatigue: 0 };
  var LEAGUE_SIZE = 48;

  function fatigueAt(p, t, strength) {
    var minutes = t * STEP_SECONDS / 60;
    return Math.max(0, Math.min(0.95, strength * (minutes / 15) * (1.1 - p.cardio)));
  }

  function effective(p, f) {
    return {
      s: p.striking * (1 - 0.4 * f),
      w: p.wrestling * (1 - 0.5 * f),
      g: p.grappling * (1 - 0.3 * f),
      e: (0.5 * p.wrestling + 0.5 * p.grappling) * (1 - 0.8 * f)
    };
  }

  // Returns the transition matrix at step t and, for every finish, the share that is a submission.
  function buildMatrix(pa, pb, t, fatigueStrength, cal) {
    var fa = fatigueAt(pa, t, fatigueStrength), fb = fatigueAt(pb, t, fatigueStrength);
    var a = effective(pa, fa), b = effective(pb, fb);
    var W = [], S = [], i;
    for (i = 0; i < NS; i++) { W.push(new Array(NS).fill(0)); S.push(new Array(NS).fill(0)); }
    var toughA = pa.durability || 1, toughB = pb.durability || 1;
    function fin(x, y, ko, sub) {
      var k = y === AF ? 1 / toughB : 1 / toughA;
      W[x][y] += (ko + sub) * k; S[x][y] += sub * k;
    }

    var r = W[D];
    r[D] = 8; r[C] = 1.2; r[SC] = 0.5 * (a.w + b.w);
    r[AT] = 0.9 * a.w * (1 - 0.6 * b.w);
    r[BT] = 0.9 * b.w * (1 - 0.6 * a.w);
    fin(D, AF, cal.stand * 0.25 * a.s * a.s * (1 + fb), 0);
    fin(D, BF, cal.stand * 0.25 * b.s * b.s * (1 + fa), 0);

    r = W[C];
    r[D] = 2.5; r[C] = 4; r[SC] = 0.6 * (a.w + b.w);
    r[AT] = 1.2 * a.w * (1 - 0.5 * b.w);
    r[BT] = 1.2 * b.w * (1 - 0.5 * a.w);
    fin(C, AF, cal.stand * 0.12 * a.s * a.s * (1 + fb), cal.stand * 0.05 * a.g);
    fin(C, BF, cal.stand * 0.12 * b.s * b.s * (1 + fa), cal.stand * 0.05 * b.g);

    r = W[SC];
    var share = (a.w + a.g + 0.1) / (a.w + a.g + b.w + b.g + 0.2);
    r[D] = 1.5; r[C] = 0.8; r[SC] = 2.5;
    r[AT] = 4 * share; r[BT] = 4 * (1 - share);
    r[AM] = 0.3 * a.g; r[BM] = 0.3 * b.g;
    fin(SC, AF, 0, cal.top * 0.15 * a.g);
    fin(SC, BF, 0, cal.top * 0.15 * b.g);

    groundRows(a, b, fb, AT, AM, BT, AF, BF);
    groundRows(b, a, fa, BT, BM, AT, BF, AF);

    function groundRows(top, bot, fBot, T, Dom, Rev, TopFin, BotFin) {
      var row = W[T];
      row[T] = 6;
      row[Dom] = 2 * top.g * (1.2 - bot.e);
      row[SC] = 1.5 * bot.e;
      row[D] = 0.4 + 0.6 * bot.e;
      row[Rev] = 0.8 * bot.g * (1 - fBot);
      fin(T, TopFin, cal.top * 0.25 * top.s * (1 + fBot), cal.top * 0.15 * top.g * (1 + fBot));
      fin(T, BotFin, 0, cal.top * 0.12 * bot.g * (1 - 0.5 * fBot));

      row = W[Dom];
      row[Dom] = 7;
      row[T] = 1.6 * bot.e;
      row[SC] = 0.8 * bot.e;
      row[Rev] = 0.15 * bot.g * (1 - fBot);
      fin(Dom, TopFin, cal.dom * 0.4 * top.s * (1 + 1.5 * fBot), cal.dom * 0.7 * top.g * (1 + 1.5 * fBot));
      fin(Dom, BotFin, 0, cal.top * 0.01);
    }

    W[AF][AF] = 1;
    W[BF][BF] = 1;
    var sub = [];
    for (i = 0; i < NS; i++) {
      var sum = 0, j;
      for (j = 0; j < NS; j++) sum += W[i][j];
      sub.push([W[i][AF] ? S[i][AF] / W[i][AF] : 0, W[i][BF] ? S[i][BF] / W[i][BF] : 0]);
      for (j = 0; j < NS; j++) W[i][j] /= sum;
    }
    return { P: W, sub: sub };
  }

  // Exact outcome distribution by propagating probability mass forward through the fight.
  function exactOutcome(pa, pb, rounds, fatigueStrength, cal) {
    var T = rounds * SPR;
    var p = new Array(NT).fill(0); p[D] = 1;
    var res = { rounds: new Array(rounds).fill(0), A: 0, B: 0, ko: 0, sub: 0, dec: 0 };
    for (var t = 0; t < T; t++) {
      if (t > 0 && t % SPR === 0) {
        var mass = p.reduce(function (s, v) { return s + v; }, 0);
        p = new Array(NT).fill(0); p[D] = mass;
      }
      var m = buildMatrix(pa, pb, t, fatigueStrength, cal);
      var np = new Array(NT).fill(0), r = Math.floor(t / SPR);
      for (var x = 0; x < NT; x++) {
        var px = p[x];
        if (!px) continue;
        var row = m.P[x];
        for (var y = 0; y < NT; y++) np[y] += px * row[y];
        var fa = px * row[AF], fb = px * row[BF];
        res.rounds[r] += fa + fb;
        res.A += fa; res.B += fb;
        res.sub += fa * m.sub[x][0] + fb * m.sub[x][1];
        res.ko += fa * (1 - m.sub[x][0]) + fb * (1 - m.sub[x][1]);
      }
      p = np;
    }
    res.dec = p.reduce(function (s, v) { return s + v; }, 0);
    return res;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // A fixed league of random matchups. Spread controls how mismatched fighters can be.
  var LEAGUE_DRAWS = (function () {
    var rand = mulberry32(20261025), draws = [];
    for (var k = 0; k < LEAGUE_SIZE; k++) {
      var u = [];
      for (var i = 0; i < 10; i++) u.push(rand() * 2 - 1);
      draws.push(u);
    }
    return draws;
  })();

  function leagueFighters(cal) {
    var clamp = function (v) { return Math.max(0.05, Math.min(0.98, v)); };
    var spread = cal.spread;
    return LEAGUE_DRAWS.map(function (u) {
      var make = function (o, d) {
        return {
          striking: clamp(0.55 + spread * u[o]), wrestling: clamp(0.55 + spread * u[o + 1]),
          grappling: clamp(0.55 + spread * u[o + 2]), cardio: clamp(0.6 + spread * u[o + 3]),
          durability: Math.exp(cal.toughness * 1.7 * u[d])
        };
      };
      return [make(0, 8), make(4, 9)];
    });
  }

  function leagueOutcome(rounds, cal) {
    var pairs = leagueFighters(cal);
    var agg = { rounds: new Array(rounds).fill(0), ko: 0, sub: 0, dec: 0 };
    pairs.forEach(function (pair) {
      var o = exactOutcome(pair[0], pair[1], rounds, cal.fatigue, cal);
      for (var r = 0; r < rounds; r++) agg.rounds[r] += o.rounds[r] / pairs.length;
      agg.ko += o.ko / pairs.length;
      agg.sub += o.sub / pairs.length;
      agg.dec += o.dec / pairs.length;
    });
    return agg;
  }

  function loss(cal) {
    var o = leagueOutcome(3, cal), real = REAL.threeRound, err = 0;
    for (var r = 0; r < 3; r++) err += Math.pow(o.rounds[r] - real.rounds[r], 2);
    err += Math.pow(o.dec - real.dec, 2);
    var koShare = o.ko / Math.max(1e-9, o.ko + o.sub);
    var realKo = REAL.method.ko / (REAL.method.ko + REAL.method.sub);
    err += 0.5 * Math.pow(koShare - realKo, 2);
    return err;
  }

  // Coordinate descent on the finish scales and the league spread, fitted to three-round bouts only.
  function fit() {
    var cal = Object.assign({}, HAND_SET), best = loss(cal);
    var grids = {
      stand: [0.5, 0.65, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2],
      top: [0.5, 0.65, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2],
      dom: [0.5, 0.65, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2],
      spread: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
      toughness: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3],
      fatigue: [0, 0.2, 0.4, 0.6, 0.8, 1]
    };
    var absolute = { spread: true, toughness: true, fatigue: true };
    for (var pass = 0; pass < 4; pass++) {
      var improved = false;
      Object.keys(grids).forEach(function (key) {
        var base = cal[key];
        grids[key].forEach(function (g) {
          var trial = Object.assign({}, cal);
          trial[key] = absolute[key] ? g : base * g;
          var l = loss(trial);
          if (l < best - 1e-12) { best = l; cal = trial; improved = true; }
        });
      });
      if (!improved) break;
    }
    return { cal: cal, loss: best };
  }

  var api = {
    D: D, C: C, SC: SC, AT: AT, AM: AM, BT: BT, BM: BM, AF: AF, BF: BF, NT: NT, NS: NS,
    STEP_SECONDS: STEP_SECONDS, SPR: SPR, REAL: REAL, HAND_SET: HAND_SET, FITTED: FITTED, LEAGUE_SIZE: LEAGUE_SIZE,
    buildMatrix: buildMatrix, exactOutcome: exactOutcome, leagueOutcome: leagueOutcome, loss: loss, fit: fit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FightChainsModel = api;
})(this);
