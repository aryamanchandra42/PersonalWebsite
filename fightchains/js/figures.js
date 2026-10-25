// Side-view fighter figures built from joint angles. Poses are written for a fighter facing right;
// limb angles are degrees from straight down (positive = toward the opponent), lean is degrees from upright.
(function (root) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LEN = { torso: 33, neck: 6.5, head: 8.6, upper: 22, fore: 21, thigh: 24, shin: 23 };
  var KEYS = ['y', 'lean', 'head', 'aFu', 'aFf', 'aBu', 'aBf', 'lFt', 'lFs', 'lBt', 'lBs'];

  function P(y, lean, head, armF, armB, legF, legB) {
    return { y: y, lean: lean, head: head, aFu: armF[0], aFf: armF[1], aBu: armB[0], aBf: armB[1], lFt: legF[0], lFs: legF[1], lBt: legB[0], lBs: legB[1] };
  }

  var POSES = {
    stance:    P(-45, 12, 2, [44, 150], [24, 160], [30, 6], [-28, -12]),
    bounce:    P(-43, 16, 2, [50, 142], [28, 154], [36, 10], [-22, -8]),
    jab:       P(-43, 24, -4, [98, 88], [20, 164], [44, 4], [-36, -18]),
    cross:     P(-41, 36, 2, [30, 156], [104, 86], [48, 8], [-42, -22]),
    hook:      P(-42, 28, 0, [82, 22], [22, 158], [40, 4], [-34, -16]),
    overhand:  P(-40, 42, 8, [24, 148], [122, 46], [46, 6], [-40, -20]),
    kick:      P(-48, -16, -8, [52, 138], [-18, 38], [10, 4], [94, 98]),
    hit:       P(-43, -18, -24, [40, 152], [14, 166], [26, -8], [-34, -16]),
    shot:      P(-26, 68, 10, [64, 68], [58, 62], [86, -6], [-52, -66]),
    sprawl:    P(-28, 74, 16, [108, 58], [96, 48], [-44, -84], [-64, -94]),
    clinch:    P(-44, 26, 4, [118, 78], [86, 54], [22, 2], [-32, -12]),
    knee:      P(-44, 20, 4, [118, 86], [90, 62], [8, 2], [76, -18]),
    clinchHit: P(-42, 8, -14, [106, 76], [74, 56], [18, -6], [-34, -16]),
    top:       P(-20, 62, 8, [74, 36], [52, 18], [16, -78], [6, -84]),
    topPosture:P(-26, 34, 2, [96, 78], [44, 16], [20, -80], [8, -86]),
    topRaise:  P(-24, 40, 0, [162, 172], [48, 16], [16, -78], [6, -84]),
    topPunch:  P(-15, 78, 16, [96, 8], [44, 14], [14, -74], [4, -80]),
    topSub:    P(-12, 88, 18, [112, 6], [96, 2], [26, -80], [6, -86]),
    bottom:    P(-9, -86, -16, [128, 88], [114, 80], [112, 38], [100, 32]),
    bottomHit: P(-7, -96, -40, [158, 128], [150, 120], [98, 48], [88, 40]),
    bottomFrame:P(-10, -78, -6, [102, 70], [94, 64], [118, 34], [108, 28]),
    bottomShrimp:P(-12, -66, -10, [120, 96], [78, 50], [64, -24], [132, 46]),
    bottomTap: P(-8, -90, -26, [86, 50], [122, 96], [110, 38], [100, 32]),
    down:      P(-6, -92, -42, [-74, -98], [-54, -84], [88, 94], [80, 96]),
    rise:      P(-28, 30, 0, [44, 138], [22, 158], [76, -12], [-12, -92]),
    win:       P(-46, -6, -10, [158, 164], [208, 194], [18, 0], [-18, -4]),
    rest:      P(-46, 4, 4, [12, 22], [8, 16], [16, 0], [-16, -2])
  };

  function dir(deg) { var r = deg * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function Figure(parent, opts) {
    this.face = opts.face;
    this.color = opts.color;
    this.dark = opts.dark;
    this.x = opts.x || 0;
    this.pose = Object.assign({}, POSES.stance);
    this.from = this.pose; this.to = this.pose; this.t0 = 0; this.dur = 1;
    this.xFrom = this.x; this.xTo = this.x;
    this.idle = true;
    this.g = el('g', { class: 'fig' }, parent);
    this.shadow = el('ellipse', { rx: 22, ry: 4, class: 'fig-shadow' }, this.g);
    var body = this.body = el('g', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, this.g);
    var back = this.dark;
    this.lB = el('polyline', { stroke: back, 'stroke-width': 7.2 }, body);
    this.aB = el('polyline', { stroke: back, 'stroke-width': 5.4 }, body);
    this.gB = el('circle', { r: 4.5, fill: opts.glove || '#c41e3a' }, body);
    this.trunk = el('line', { stroke: this.color, 'stroke-width': 10.6 }, body);
    this.shorts = el('line', { stroke: this.dark, 'stroke-width': 12 }, body);
    this.headEl = el('circle', { r: LEN.head - 0.5, fill: opts.skin || '#d4b896' }, body);
    this.lF = el('polyline', { stroke: this.color, 'stroke-width': 7.2 }, body);
    this.aF = el('polyline', { stroke: this.color, 'stroke-width': 5.4 }, body);
    this.gF = el('circle', { r: 4.6, fill: opts.glove || '#c41e3a', stroke: this.dark, 'stroke-width': 1.1 }, body);
    this.label = opts.label;
  }

  Figure.prototype.set = function (name, ms, x, now) {
    var target = typeof name === 'string' ? POSES[name] : name;
    this.from = Object.assign({}, this.pose);
    this.to = target;
    this.xFrom = this.x;
    if (x !== undefined) this.xTo = x;
    this.t0 = now; this.dur = Math.max(1, ms);
    this.idle = name === 'stance' || name === 'bounce' || name === 'clinch';
  };

  Figure.prototype.update = function (now) {
    var t = Math.min(1, (now - this.t0) / this.dur), e = ease(t);
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      this.pose[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    }
    this.x = this.xFrom + (this.xTo - this.xFrom) * e;
    var bob = this.idle && t >= 1 ? Math.sin(now / 140 + this.face) * 1.7 : 0;
    this.draw(bob);
  };

  Figure.prototype.draw = function (bob) {
    var p = this.pose, f = this.face, ox = this.x;
    function pt(x, y) { return [ox + f * x, y]; }
    var hip = [0, p.y + bob];
    var td = dir(180 - p.lean);
    var sh = [hip[0] + LEN.torso * td[0], hip[1] + LEN.torso * td[1]];
    var hd = dir(180 - p.lean - p.head);
    var head = [sh[0] + (LEN.neck + LEN.head) * hd[0], sh[1] + (LEN.neck + LEN.head) * hd[1]];
    function chain(base, a1, l1, a2, l2) {
      var d1 = dir(a1), d2 = dir(a2);
      var m = [base[0] + l1 * d1[0], base[1] + l1 * d1[1]];
      return [base, m, [m[0] + l2 * d2[0], m[1] + l2 * d2[1]]];
    }
    var armF = chain(sh, p.aFu, LEN.upper, p.aFf, LEN.fore);
    var armB = chain(sh, p.aBu, LEN.upper, p.aBf, LEN.fore);
    var legF = chain(hip, p.lFt, LEN.thigh, p.lFs, LEN.shin);
    var legB = chain(hip, p.lBt, LEN.thigh, p.lBs, LEN.shin);
    function poly(node, pts) { node.setAttribute('points', pts.map(function (q) { var w = pt(q[0], q[1]); return w[0].toFixed(1) + ',' + w[1].toFixed(1); }).join(' ')); }
    function line(node, a, b) {
      var A = pt(a[0], a[1]), B = pt(b[0], b[1]);
      node.setAttribute('x1', A[0].toFixed(1)); node.setAttribute('y1', A[1].toFixed(1));
      node.setAttribute('x2', B[0].toFixed(1)); node.setAttribute('y2', B[1].toFixed(1));
    }
    function circ(node, q) { var w = pt(q[0], q[1]); node.setAttribute('cx', w[0].toFixed(1)); node.setAttribute('cy', w[1].toFixed(1)); }
    poly(this.lB, legB); poly(this.aB, armB); circ(this.gB, armB[2]);
    line(this.trunk, hip, sh);
    var waist = [hip[0] + 7 * td[0], hip[1] + 7 * td[1]];
    line(this.shorts, [hip[0] - 1.5 * td[0], hip[1] - 1.5 * td[1]], waist);
    circ(this.headEl, head);
    poly(this.lF, legF); poly(this.aF, armF); circ(this.gF, armF[2]);
    var hx = ox + f * hip[0];
    this.shadow.setAttribute('cx', hx.toFixed(1));
    this.shadow.setAttribute('cy', '1');
    this.shadow.setAttribute('rx', p.y > -20 ? 34 : 20);
    if (this.label) {
      var top = Math.min(head[1], sh[1], hip[1]) - LEN.head - 10;
      this.label.setAttribute('x', (ox + f * head[0]).toFixed(1));
      this.label.setAttribute('y', Math.max(-175, top).toFixed(1));
    }
  };

  root.FightFigures = { Figure: Figure, POSES: POSES, el: el };
})(this);
