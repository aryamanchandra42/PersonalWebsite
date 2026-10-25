// Matchup chain, mirroring pipeline/model.py. Fighter rates and league constants come from web/data.
(function (root) {
  'use strict';

  var DIST = 0, CLINCH = 1, A_TOP = 2, B_TOP = 3, A_KO = 4, A_SUB = 5, B_KO = 6, B_SUB = 7;
  var NT = 4, NS = 8;

  function combo(off, vuln, league) { return off * vuln / league; }

  function rateMatrix(a, b, league) {
    var L = league.rates, cal = league.cal;
    var Q = [];
    for (var i = 0; i < NS; i++) Q.push(new Array(NS).fill(0));
    var share = Math.min(0.9, (a.clinch_share + b.clinch_share) / 2);
    var tdA = combo(a.td, b.td_vuln, L.td), tdB = combo(b.td, a.td_vuln, L.td);
    var koA = cal.ko_stand * combo(a.ko_stand, b.ko_stand_vuln, L.ko_stand);
    var koB = cal.ko_stand * combo(b.ko_stand, a.ko_stand_vuln, L.ko_stand);
    [DIST, CLINCH].forEach(function (s) {
      Q[s][A_TOP] = tdA; Q[s][B_TOP] = tdB; Q[s][A_KO] = koA; Q[s][B_KO] = koB;
    });
    Q[DIST][CLINCH] = league.clinch_exit * share / (1 - share);
    Q[CLINCH][DIST] = league.clinch_exit;

    function ground(top, bot, T, Bt, topKo, topSub, botSub) {
      var exit = combo(top.top_exit, bot.bottom_exit, L.top_exit);
      var rev = combo(bot.rev, top.rev_vuln, L.rev);
      Q[T][Bt] = Math.min(rev, 0.8 * exit);
      Q[T][DIST] = exit - Q[T][Bt];
      Q[T][topKo] = cal.ground * combo(top.gnp, bot.gnp_vuln, L.gnp);
      Q[T][topSub] = cal.ground * combo(top.sub, bot.sub_vuln, L.sub);
      Q[T][botSub] = league.sub_from_bottom;
    }
    ground(a, b, A_TOP, B_TOP, A_KO, A_SUB, B_SUB);
    ground(b, a, B_TOP, A_TOP, B_KO, B_SUB, A_SUB);
    return Q;
  }

  function stepMatrix(Q, dtMin) {
    return Q.map(function (row, i) {
      var out = row.reduce(function (s, v) { return s + v; }, 0);
      var P = new Array(NS).fill(0);
      if (out <= 0) { P[i] = 1; return P; }
      var leave = 1 - Math.exp(-out * dtMin);
      for (var j = 0; j < NS; j++) P[j] = row[j] / out * leave;
      P[i] = 1 - leave;
      return P;
    });
  }

  function mul(p, P) {
    var out = new Array(NS).fill(0);
    for (var i = 0; i < NS; i++) {
      if (!p[i]) continue;
      for (var j = 0; j < NS; j++) out[j] += p[i] * P[i][j];
    }
    return out;
  }

  function outcome(P, rounds, steps, dtMin) {
    var p = new Array(NS).fill(0), occ = new Array(NT).fill(0), byRound = [];
    for (var r = 0; r < rounds; r++) {
      var mass = r ? p.slice(0, NT).reduce(function (s, v) { return s + v; }, 0) : 1;
      for (var k = 0; k < NT; k++) p[k] = 0;
      p[DIST] = mass;
      var before = p.slice(NT);
      for (var s = 0; s < steps; s++) {
        for (k = 0; k < NT; k++) occ[k] += p[k] * dtMin;
        p = mul(p, P);
      }
      byRound.push(p.slice(NT).map(function (v, i) { return v - before[i]; }));
    }
    return { finish: p.slice(NT), dec: p.slice(0, NT).reduce(function (s, v) { return s + v; }, 0), byRound: byRound, occupancy: occ };
  }

  function decisionShare(a, b, occ, league) {
    var L = league.rates, total = Math.max(1e-9, occ.reduce(function (s, v) { return s + v; }, 0));
    var stand = occ[DIST] + occ[CLINCH];
    var landA = stand * combo(a.land_stand, b.absorb_stand, L.land_stand) + occ[A_TOP] * combo(a.land_ground, b.absorb_ground, L.land_ground);
    var landB = stand * combo(b.land_stand, a.absorb_stand, L.land_stand) + occ[B_TOP] * combo(b.land_ground, a.absorb_ground, L.land_ground);
    var z = league.beta[0] * (landA - landB) / total + league.beta[1] * (occ[A_TOP] - occ[B_TOP]) / total;
    return 1 / (1 + Math.exp(-z));
  }

  function logit(p) { p = Math.min(1 - 1e-4, Math.max(1e-4, p)); return Math.log(p / (1 - p)); }

  // Full prediction for fighter a (A) vs fighter b (B).
  function predict(a, b, rounds, league) {
    var dtMin = league.dt_sec / 60;
    var P = stepMatrix(rateMatrix(a, b, league), dtMin);
    var o = outcome(P, rounds, league.steps_per_round, dtMin);
    var decA = decisionShare(a, b, o.occupancy, league);
    var raw = o.finish[0] + o.finish[1] + o.dec * decA;
    var pA = 1 / (1 + Math.exp(-league.stack[0] * logit(raw)));
    // Scale each side's outcomes so they add up to the calibrated win chance.
    var sA = pA / raw, sB = (1 - pA) / (1 - raw);
    var split = {
      aKo: o.finish[0] * sA, aSub: o.finish[1] * sA, aDec: o.dec * decA * sA,
      bDec: o.dec * (1 - decA) * sB, bSub: o.finish[3] * sB, bKo: o.finish[2] * sB
    };
    var byRound = o.byRound.map(function (f) { return { a: (f[0] + f[1]) * sA, b: (f[2] + f[3]) * sB }; });
    return {
      P: P, pA: pA, raw: raw, dec: split.aDec + split.bDec, judgesA: split.aDec / Math.max(1e-9, split.aDec + split.bDec),
      split: split, byRound: byRound, occupancy: o.occupancy
    };
  }

  // Chance of each fighter finishing from every state at every step, for the live bar.
  function liveChances(P, rounds, steps) {
    var T = rounds * steps;
    var VA = new Array(T + 1), VB = new Array(T + 1);
    var endA = new Array(NS).fill(0), endB = new Array(NS).fill(0);
    endA[A_KO] = endA[A_SUB] = 1; endB[B_KO] = endB[B_SUB] = 1;
    VA[T] = endA; VB[T] = endB;
    for (var t = T - 1; t >= 0; t--) {
      var nA = VA[t + 1], nB = VB[t + 1];
      if ((t + 1) % steps === 0 && t + 1 < T) {
        nA = nA.map(function (v, y) { return y < NT ? VA[t + 1][DIST] : v; });
        nB = nB.map(function (v, y) { return y < NT ? VB[t + 1][DIST] : v; });
      }
      var a = new Array(NS).fill(0), b = new Array(NS).fill(0);
      for (var x = 0; x < NS; x++) {
        for (var y = 0; y < NS; y++) { a[x] += P[x][y] * nA[y]; b[x] += P[x][y] * nB[y]; }
      }
      VA[t] = a; VB[t] = b;
    }
    return { A: VA, B: VB };
  }

  var api = {
    DIST: DIST, CLINCH: CLINCH, A_TOP: A_TOP, B_TOP: B_TOP, A_KO: A_KO, A_SUB: A_SUB, B_KO: B_KO, B_SUB: B_SUB, NT: NT, NS: NS,
    rateMatrix: rateMatrix, stepMatrix: stepMatrix, predict: predict, liveChances: liveChances, combo: combo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FightChain = api;
})(this);
