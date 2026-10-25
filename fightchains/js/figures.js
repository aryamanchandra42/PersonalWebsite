// Side-view fighter figures built from joint angles. Poses are written for a fighter facing right;
// limb angles are degrees from straight down (positive = toward the opponent), lean is degrees from upright.
(function (root) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LEN = { torso: 30, neck: 6, head: 8.5, upper: 16, fore: 15, thigh: 20, shin: 20 };
  var KEYS = ['y', 'lean', 'head', 'aFu', 'aFf', 'aBu', 'aBf', 'lFt', 'lFs', 'lBt', 'lBs'];

  function P(y, lean, head, armF, armB, legF, legB) {
    return { y: y, lean: lean, head: head, aFu: armF[0], aFf: armF[1], aBu: armB[0], aBf: armB[1], lFt: legF[0], lFs: legF[1], lBt: legB[0], lBs: legB[1] };
  }

  var POSES = {
    stance:   P(-38.5, 8, 0, [35, 160], [15, 170], [22, 0], [-22, -8]),
    bounce:   P(-37.5, 10, 0, [38, 158], [18, 168], [24, 2], [-20, -6]),
    jab:      P(-38, 14, 0, [88, 90], [15, 170], [26, 0], [-24, -10]),
    cross:    P(-37, 22, 0, [25, 165], [86, 88], [28, 4], [-30, -14]),
    kick:     P(-40, -18, -6, [40, 150], [-20, 40], [4, 0], [82, 100]),
    hit:      P(-37, -12, -18, [30, 165], [10, 172], [20, -4], [-26, -12]),
    shot:     P(-24, 65, 10, [60, 70], [55, 65], [80, -5], [-48, -62]),
    sprawl:   P(-26, 70, 15, [100, 60], [90, 50], [-40, -80], [-60, -90]),
    clinch:   P(-37, 24, 4, [112, 82], [80, 58], [18, 0], [-28, -10]),
    knee:     P(-38, 18, 4, [112, 90], [84, 66], [6, 0], [70, -20]),
    clinchHit:P(-36, 8, -12, [100, 80], [70, 60], [16, -4], [-30, -14]),
    top:      P(-18, 46, 6, [62, 32], [50, 20], [24, -90], [12, -90]),
    topRaise: P(-20, 26, 0, [150, 175], [50, 20], [24, -90], [12, -90]),
    topPunch: P(-17, 58, 10, [62, 55], [50, 20], [24, -90], [12, -90]),
    topSub:   P(-12, 80, 20, [100, 15], [86, 8], [30, -85], [10, -88]),
    bottom:   P(-8, -90, -30, [150, 128], [140, 118], [128, 62], [118, 52]),
    bottomHit:P(-7, -92, -50, [165, 150], [158, 140], [122, 60], [112, 50]),
    bottomTap:P(-8, -90, -30, [95, 70], [140, 118], [128, 62], [118, 52]),
    down:     P(-6, -90, -40, [-70, -95], [-50, -80], [84, 90], [76, 92]),
    rise:     P(-24, 28, 0, [40, 140], [20, 160], [70, -10], [-10, -90]),
    win:      P(-39, -4, -10, [150, 160], [200, 190], [16, 0], [-16, -4]),
    rest:     P(-39, 2, 4, [10, 20], [6, 14], [14, 0], [-14, -2])
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
    this.lB = el('polyline', { stroke: back, 'stroke-width': 8.5 }, body);
    this.aB = el('polyline', { stroke: back, 'stroke-width': 6.5 }, body);
    this.gB = el('circle', { r: 4.6, fill: back }, body);
    this.trunk = el('line', { stroke: this.color, 'stroke-width': 13 }, body);
    this.shorts = el('line', { stroke: this.dark, 'stroke-width': 14 }, body);
    this.headEl = el('circle', { r: LEN.head, fill: this.color }, body);
    this.lF = el('polyline', { stroke: this.color, 'stroke-width': 8.5 }, body);
    this.aF = el('polyline', { stroke: this.color, 'stroke-width': 6.5 }, body);
    this.gF = el('circle', { r: 4.8, fill: '#f4efe6', stroke: this.dark, 'stroke-width': 1.6 }, body);
    this.label = opts.label;
  }

  Figure.prototype.set = function (name, ms, x, now) {
    var target = typeof name === 'string' ? POSES[name] : name;
    this.from = Object.assign({}, this.pose);
    this.to = target;
    this.xFrom = this.x;
    if (x !== undefined) this.xTo = x;
    this.t0 = now; this.dur = Math.max(1, ms);
    this.idle = name === 'stance' || name === 'clinch';
  };

  Figure.prototype.update = function (now) {
    var t = Math.min(1, (now - this.t0) / this.dur), e = ease(t);
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      this.pose[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    }
    this.x = this.xFrom + (this.xTo - this.xFrom) * e;
    var bob = this.idle && t >= 1 ? Math.sin(now / 160 + this.face) * 0.9 : 0;
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
      this.label.setAttribute('y', Math.max(-150, top).toFixed(1));
    }
  };

  root.FightFigures = { Figure: Figure, POSES: POSES, el: el };
})(this);
