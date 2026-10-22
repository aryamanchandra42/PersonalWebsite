(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.rs-row'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.rs-panel'));
  if (!rows.length) return;

  function loadFrames(panel) {
    panel.querySelectorAll('iframe[data-src]').forEach(function (f) {
      f.src = f.getAttribute('data-src');
      f.removeAttribute('data-src');
    });
  }

  function typeset(panel) {
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([panel]);
  }

  function select(id, opts) {
    opts = opts || {};
    var panel = document.getElementById(id);
    if (!panel) return;
    rows.forEach(function (r) {
      var on = r.dataset.target === id;
      r.classList.toggle('is-active', on);
      r.setAttribute('aria-selected', on);
      r.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      var on = p === panel;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });
    loadFrames(panel);
    typeset(panel);
    if (opts.hash !== false) history.replaceState(null, '', '#' + id);
    if (opts.scroll && window.matchMedia('(max-width:980px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  rows.forEach(function (row, i) {
    row.addEventListener('click', function () { select(row.dataset.target, { scroll: true }); });
    row.addEventListener('keydown', function (e) {
      var vis = rows.filter(function (r) { return !r.parentElement.hidden; });
      var k = vis.indexOf(row), n = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = vis[(k + 1) % vis.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = vis[(k - 1 + vis.length) % vis.length];
      if (n) { e.preventDefault(); n.focus(); select(n.dataset.target); }
    });
  });

  // Inner tabs
  panels.forEach(function (panel) {
    var tabs = panel.querySelectorAll('.rs-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.toggle('is-on', t === tab); });
        panel.querySelectorAll('.rs-pane').forEach(function (p) {
          p.classList.toggle('is-on', p.dataset.pane === tab.dataset.pane);
        });
        typeset(panel);
      });
    });
  });

  // Filter chips
  var chips = document.querySelectorAll('.rs-chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      var f = chip.dataset.filter, first = null;
      rows.forEach(function (r) {
        var show = f === 'all' || r.parentElement.dataset.kind === f;
        r.parentElement.hidden = !show;
        if (show && !first) first = r;
      });
      var active = rows.filter(function (r) { return r.classList.contains('is-active'); })[0];
      if (first && (!active || active.parentElement.hidden)) select(first.dataset.target);
    });
  });

  var start = (location.hash || '').slice(1);
  select(document.getElementById(start) && document.getElementById(start).classList.contains('rs-panel') ? start : 'spectral', { hash: !!start });
  window.addEventListener('hashchange', function () {
    var h = location.hash.slice(1);
    var el = document.getElementById(h);
    if (el && el.classList.contains('rs-panel')) select(h, { hash: false });
  });
})();
