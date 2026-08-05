(function () {
  var PALETTE = [
    "#ff9c00", "#99ccff", "#cc6699", "#ffcc66",
    "#cc99cc", "#66ccb8", "#ff7755", "#9999cc",
    "#ffaa90", "#77bbee", "#dd8855", "#aacc77", "#ee6688"
  ];

  var nodes = window.FLECS_TOUR.nodes;
  var byId = {};
  var children = {};
  var decks = [];
  var dfs = [];

  nodes.forEach(function (n) { byId[n.id] = n; children[n.id] = []; });
  nodes.forEach(function (n) {
    if (n.parent === null || n.parent === undefined) {
      decks.push(n);
    } else if (children[n.parent]) {
      children[n.parent].push(n);
    } else {
      console.warn("orphan node", n.id, "parent", n.parent);
    }
  });
  decks.sort(function (a, b) { return a.order - b.order; });
  Object.keys(children).forEach(function (k) {
    children[k].sort(function (a, b) { return a.order - b.order; });
  });

  decks.forEach(function (d, i) { d._color = PALETTE[i % PALETTE.length]; });

  function walk(n, deck) {
    n._deck = deck;
    dfs.push(n);
    children[n.id].forEach(function (c) { walk(c, deck); });
  }
  decks.forEach(function (d) { walk(d, d); });
  dfs.forEach(function (n, i) { n._idx = i; });

  function ancestors(n) {
    var out = [];
    var cur = n;
    while (cur.parent !== null && cur.parent !== undefined && byId[cur.parent]) {
      cur = byId[cur.parent];
      out.unshift(cur);
    }
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function soft(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + ",0.14)";
  }

  var treeEl = document.getElementById("tree");
  var contentEl = document.getElementById("content");
  var searchEl = document.getElementById("search");
  var prevBtn = document.getElementById("prev-btn");
  var nextBtn = document.getElementById("next-btn");
  var headerTitle = document.getElementById("header-title");

  function buildTree() {
    treeEl.innerHTML = "";
    decks.forEach(function (d) {
      var deckEl = document.createElement("div");
      deckEl.className = "tree-deck";
      deckEl.dataset.id = d.id;
      deckEl.style.setProperty("--deck-color", d._color);

      var btn = document.createElement("button");
      btn.className = "tree-item depth-0";
      btn.dataset.id = d.id;
      btn.innerHTML = '<span class="chev">&#9662;</span><span>' + esc(d.title) + "</span>";
      btn.addEventListener("click", function () {
        if (deckEl.classList.contains("open") && location.hash === "#/" + d.id) {
          deckEl.classList.remove("open");
        } else {
          deckEl.classList.add("open");
          go(d.id);
        }
      });
      deckEl.appendChild(btn);

      var sub = document.createElement("div");
      sub.className = "tree-sub";
      children[d.id].forEach(function (c) {
        sub.appendChild(buildItem(c, d));
      });
      deckEl.appendChild(sub);
      treeEl.appendChild(deckEl);
    });
  }

  function buildItem(n, deck) {
    var wrap = document.createElement("div");
    wrap.dataset.id = n.id;
    var kids = children[n.id];
    var btn = document.createElement("button");
    btn.className = "tree-item child" + (kids.length ? "" : " leaf");
    btn.dataset.id = n.id;
    btn.style.setProperty("--deck-color", deck._color);
    btn.innerHTML = '<span class="twisty">&#9656;</span><span>' + esc(n.title) + "</span>";
    btn.addEventListener("click", function () { go(n.id); });
    wrap.appendChild(btn);
    if (kids.length) {
      var nest = document.createElement("div");
      nest.className = "tree-nest";
      kids.forEach(function (c) { nest.appendChild(buildItem(c, deck)); });
      wrap.appendChild(nest);
    }
    return wrap;
  }

  function syncTree(n) {
    treeEl.querySelectorAll(".tree-item.active").forEach(function (el) {
      el.classList.remove("active");
    });
    var chain = ancestors(n).concat([n]);
    var deck = chain[0];
    treeEl.querySelectorAll(".tree-deck.open").forEach(function (el) {
      if (el.dataset.id !== deck.id) el.classList.remove("open");
    });
    var deckEl = treeEl.querySelector('.tree-deck[data-id="' + deck.id + '"]');
    if (deckEl) deckEl.classList.add("open");
    chain.forEach(function (a) {
      var el = treeEl.querySelector('[data-id="' + a.id + '"] > .tree-nest, .tree-deck[data-id="' + a.id + '"] > .tree-sub');
      if (el) el.classList.add("open");
    });
    var btn = treeEl.querySelector('.tree-item[data-id="' + n.id + '"]');
    if (btn) {
      btn.classList.add("active");
      var r = btn.getBoundingClientRect();
      var tr = treeEl.getBoundingClientRect();
      if (r.top < tr.top || r.bottom > tr.bottom) {
        btn.scrollIntoView({ block: "center" });
      }
    }
  }

  function textW(s, size) { return String(s).length * size * 0.56; }

  function renderFlow(spec, color) {
    var margin = 24, colGap = 90, rowGap = 22, padX = 18;
    var pos = {};
    var colWs = [];
    var colHs = [];
    spec.lanes.forEach(function (lane, ci) {
      var w = 110;
      lane.forEach(function (b) {
        w = Math.max(w, textW(b.label, 14.5) + padX * 2, b.sub ? textW(b.sub, 11) + padX * 2 : 0);
      });
      colWs[ci] = Math.min(w, 280);
      var h = 0;
      lane.forEach(function (b) { h += (b.sub ? 58 : 42) + rowGap; });
      colHs[ci] = h - rowGap;
    });
    var totalH = Math.max.apply(null, colHs) + margin * 2;
    var x = margin;
    spec.lanes.forEach(function (lane, ci) {
      var y = (totalH - colHs[ci]) / 2;
      lane.forEach(function (b) {
        var bh = b.sub ? 58 : 42;
        pos[b.id] = { x: x, y: y, w: colWs[ci], h: bh, b: b };
        y += bh + rowGap;
      });
      x += colWs[ci] + colGap;
    });
    var totalW = x - colGap + margin;
    var s = "";
    s += '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">';
    s += '<path d="M 0 0 L 10 5 L 0 10 z" fill="' + color + '"/></marker></defs>';
    (spec.edges || []).forEach(function (e) {
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      var p, lx, ly;
      if (b.x > a.x + a.w) {
        var sx = a.x + a.w, sy = a.y + a.h / 2;
        var tx = b.x - 3, ty = b.y + b.h / 2;
        var mx = (sx + tx) / 2;
        p = "M " + sx + " " + sy + " C " + mx + " " + sy + ", " + mx + " " + ty + ", " + tx + " " + ty;
        lx = mx; ly = (sy + ty) / 2 - 8;
      } else {
        var sx2 = a.x + a.w / 2, sy2 = a.y + a.h;
        var tx2 = b.x + b.w / 2, ty2 = b.y + b.h + 3;
        var dy = Math.max(sy2, ty2) + 26;
        p = "M " + sx2 + " " + sy2 + " C " + sx2 + " " + dy + ", " + tx2 + " " + dy + ", " + tx2 + " " + ty2;
        lx = (sx2 + tx2) / 2; ly = dy - 6;
        totalH = Math.max(totalH, dy + 16);
      }
      s += '<path d="' + p + '" fill="none" stroke="' + color + '" stroke-width="1.6" marker-end="url(#arr)"' +
        (e.dashed ? ' stroke-dasharray="6 5" opacity="0.7"' : "") + "/>";
      if (e.label) {
        s += '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" font-size="11" fill="#9a9aa8" ' +
          'style="paint-order:stroke;stroke:#0d0d12;stroke-width:5" font-family="Inter,sans-serif">' + esc(e.label) + "</text>";
      }
    });
    Object.keys(pos).forEach(function (k) {
      var q = pos[k];
      var c = q.b.color || color;
      s += '<rect x="' + q.x + '" y="' + q.y + '" width="' + q.w + '" height="' + q.h + '" rx="11" fill="#16161e" stroke="' + c + '" stroke-width="1.6"/>';
      s += '<rect x="' + q.x + '" y="' + q.y + '" width="7" height="' + q.h + '" rx="3.5" fill="' + c + '"/>';
      var ty = q.b.sub ? q.y + q.h / 2 - 6 : q.y + q.h / 2 + 1;
      s += '<text x="' + (q.x + q.w / 2 + 3) + '" y="' + ty + '" text-anchor="middle" dominant-baseline="middle" font-size="14.5" letter-spacing="0.5" fill="' + c + '" font-family="Antonio,Arial Narrow,sans-serif" style="text-transform:uppercase">' + esc(q.b.label) + "</text>";
      if (q.b.sub) {
        s += '<text x="' + (q.x + q.w / 2 + 3) + '" y="' + (q.y + q.h / 2 + 13) + '" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#9a9aa8" font-family="Inter,sans-serif">' + esc(q.b.sub) + "</text>";
      }
    });
    return '<svg viewBox="0 0 ' + totalW + " " + totalH + '" width="' + totalW + '" role="img">' + s + "</svg>";
  }

  function renderStack(spec, color) {
    var w = 460, lh, gap = 9, y = 4, s = "";
    var rows = spec.layers.map(function (l) {
      lh = l.sub ? 58 : 44;
      var r = { l: l, y: y, h: lh };
      y += lh + gap;
      return r;
    });
    var totalH = y - gap + 4;
    rows.forEach(function (r) {
      var c = r.l.color || color;
      s += '<rect x="4" y="' + r.y + '" width="' + (w - 8) + '" height="' + r.h + '" rx="11" fill="#16161e" stroke="' + c + '" stroke-width="1.6"/>';
      s += '<rect x="4" y="' + r.y + '" width="7" height="' + r.h + '" rx="3.5" fill="' + c + '"/>';
      var ty = r.l.sub ? r.y + r.h / 2 - 6 : r.y + r.h / 2 + 1;
      s += '<text x="' + (w / 2 + 3) + '" y="' + ty + '" text-anchor="middle" dominant-baseline="middle" font-size="15" letter-spacing="0.5" fill="' + c + '" font-family="Antonio,Arial Narrow,sans-serif">' + esc(r.l.label) + "</text>";
      if (r.l.sub) {
        s += '<text x="' + (w / 2 + 3) + '" y="' + (r.y + r.h / 2 + 13) + '" text-anchor="middle" dominant-baseline="middle" font-size="11.5" fill="#9a9aa8" font-family="Inter,sans-serif">' + esc(r.l.sub) + "</text>";
      }
    });
    return '<svg viewBox="0 0 ' + w + " " + totalH + '" width="' + w + '" role="img">' + s + "</svg>";
  }

  function renderGrid(spec) {
    var h = '<div class="grid-diagram">';
    if (spec.title) h += '<div class="grid-title">' + esc(spec.title) + "</div>";
    h += "<table><thead><tr>";
    spec.cols.forEach(function (c) { h += "<th>" + esc(c) + "</th>"; });
    h += "</tr></thead><tbody>";
    spec.rows.forEach(function (r) {
      h += "<tr>";
      r.forEach(function (cell) { h += "<td>" + esc(cell) + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody></table>";
    if (spec.note) h += '<div class="diagram-note">' + esc(spec.note) + "</div>";
    h += "</div>";
    return h;
  }

  function renderBlock(b, color) {
    var h = '<section class="section">';
    if (b.heading) h += '<h2 class="section-heading">' + esc(b.heading) + "</h2>";
    if (b.type === "text") {
      h += b.html;
    } else if (b.type === "code") {
      h += '<div class="codeblock"><div class="codeblock-bar"><span>' + esc(b.title || "sample") +
        '</span><span class="lang">' + esc(b.lang || "c") + "</span></div><pre>" + esc(b.src) + "</pre></div>";
    } else if (b.type === "struct") {
      h += '<div class="struct-name">' + esc(b.name) + "</div>";
      if (b.summary) h += '<div class="struct-summary">' + esc(b.summary) + "</div>";
      h += '<table class="struct-table"><thead><tr><th>Member</th><th>Type</th><th>What it does</th></tr></thead><tbody>';
      b.members.forEach(function (m) {
        h += '<tr><td class="m-name">' + esc(m.name) + '</td><td class="m-type">' + esc(m.type) +
          '</td><td class="m-desc">' + esc(m.desc) + "</td></tr>";
      });
      h += "</tbody></table>";
    } else if (b.type === "diagram") {
      var spec = b.spec;
      h += '<div class="diagram-panel">';
      if (spec.type === "flow") h += renderFlow(spec, color);
      else if (spec.type === "stack") h += renderStack(spec, color);
      else if (spec.type === "grid") h += renderGrid(spec);
      else if (spec.type === "svg") h += spec.svg;
      if (spec.type !== "grid" && spec.note) h += '<div class="diagram-note">' + esc(spec.note) + "</div>";
      h += "</div>";
    }
    h += "</section>";
    return h;
  }

  function renderPage(n) {
    var color = n._deck._color;
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-soft", soft(color));
    headerTitle.textContent = n._deck.title;

    var h = "";
    h += '<nav id="breadcrumb"><a href="#/' + decks[0].id + '">Tour</a>';
    ancestors(n).forEach(function (a) {
      h += '<span class="sep">&#9656;</span><a href="#/' + a.id + '">' + esc(a.title) + "</a>";
    });
    h += '<span class="sep">&#9656;</span><span class="here">' + esc(n.title) + "</span></nav>";

    h += '<header class="page-head">';
    h += '<div class="page-code">' + esc(n.code || "FLX") + "</div>";
    h += '<h1 class="page-title">' + esc(n.title) + "</h1>";
    if (n.tagline) h += '<div class="page-tagline">' + esc(n.tagline) + "</div>";
    h += "</header>";

    if (n.intro) h += '<div class="page-intro">' + n.intro + "</div>";

    (n.sections || []).forEach(function (b) { h += renderBlock(b, color); });

    var kids = children[n.id];
    if (kids.length) {
      h += '<section class="section"><h2 class="section-heading">Go deeper</h2><div class="children-grid">';
      kids.forEach(function (c) {
        h += '<a class="child-card" href="#/' + c.id + '" style="border-left-color:' + n._deck._color + '">' +
          '<div class="cc-code">' + esc(c.code || "") + '</div>' +
          '<div class="cc-title">' + esc(c.title) + '</div>' +
          '<div class="cc-tag">' + esc(c.tagline || "") + "</div></a>";
      });
      h += "</div></section>";
    }

    if (n.related && n.related.length) {
      h += '<section class="section"><h2 class="section-heading">Related</h2><div class="related-row">';
      n.related.forEach(function (rid) {
        var r = byId[rid];
        if (r) h += '<a class="related-chip" href="#/' + r.id + '">' + esc(r.title) + "</a>";
      });
      h += "</div></section>";
    }

    contentEl.innerHTML = h;
    contentEl.classList.remove("fade");
    void contentEl.offsetWidth;
    contentEl.classList.add("fade");
    contentEl.scrollTop = 0;

    var prev = n._idx > 0 ? dfs[n._idx - 1] : null;
    var next = n._idx < dfs.length - 1 ? dfs[n._idx + 1] : null;
    prevBtn.disabled = !prev;
    nextBtn.disabled = !next;
    prevBtn.querySelector(".nav-label").textContent = prev ? prev.title : "—";
    nextBtn.querySelector(".nav-label").textContent = next ? next.title : "—";
    prevBtn.onclick = prev ? function () { go(prev.id); } : null;
    nextBtn.onclick = next ? function () { go(next.id); } : null;

    syncTree(n);
  }

  function current() {
    var id = location.hash.replace(/^#\/?/, "");
    return byId[id] || decks[0];
  }

  function go(id) { location.hash = "#/" + id; }

  window.addEventListener("hashchange", function () { renderPage(current()); });

  document.addEventListener("keydown", function (e) {
    if (e.target === searchEl) {
      if (e.key === "Escape") { searchEl.value = ""; applySearch(""); searchEl.blur(); }
      return;
    }
    if (e.key === "ArrowRight" && !nextBtn.disabled) nextBtn.onclick();
    if (e.key === "ArrowLeft" && !prevBtn.disabled) prevBtn.onclick();
    if (e.key === "/" ) { e.preventDefault(); searchEl.focus(); }
  });

  function applySearch(q) {
    q = q.trim().toLowerCase();
    var deckEls = treeEl.querySelectorAll(".tree-deck");
    if (!q) {
      treeEl.querySelectorAll(".hidden").forEach(function (el) { el.classList.remove("hidden"); });
      deckEls.forEach(function (el) { el.classList.remove("open"); });
      treeEl.querySelectorAll(".tree-nest.open").forEach(function (el) { el.classList.remove("open"); });
      syncTree(current());
      return;
    }
    function matches(n) {
      return n.title.toLowerCase().indexOf(q) >= 0 ||
        (n.tagline || "").toLowerCase().indexOf(q) >= 0 ||
        n.id.indexOf(q) >= 0;
    }
    function visit(n) {
      var kidVisible = false;
      children[n.id].forEach(function (c) { if (visit(c)) kidVisible = true; });
      var self = matches(n);
      var show = self || kidVisible;
      var wrap = treeEl.querySelector('div[data-id="' + n.id + '"]');
      if (wrap && !wrap.classList.contains("tree-deck")) {
        wrap.classList.toggle("hidden", !show);
        var nest = wrap.querySelector(":scope > .tree-nest");
        if (nest) nest.classList.toggle("open", kidVisible);
      }
      return show;
    }
    decks.forEach(function (d) {
      var any = false;
      children[d.id].forEach(function (c) { if (visit(c)) any = true; });
      var deckEl = treeEl.querySelector('.tree-deck[data-id="' + d.id + '"]');
      var show = any || matches(d);
      deckEl.classList.toggle("hidden", !show);
      deckEl.classList.toggle("open", any);
    });
  }

  searchEl.addEventListener("input", function () { applySearch(searchEl.value); });
  searchEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var first = treeEl.querySelector(".tree-deck:not(.hidden) .tree-item.child:not(.hidden), .tree-deck:not(.hidden) .tree-item.depth-0");
      var q = searchEl.value.trim().toLowerCase();
      var hit = null;
      for (var i = 0; i < dfs.length; i++) {
        var n = dfs[i];
        if (n.title.toLowerCase().indexOf(q) >= 0 || n.id.indexOf(q) >= 0) { hit = n; break; }
      }
      if (hit) go(hit.id);
      else if (first) go(first.dataset.id);
    }
  });

  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var doy = Math.floor((now - start) / 86400000);
  var stardate = ((now.getFullYear() - 1987) * 1000 + (doy / 366) * 1000).toFixed(1);
  document.getElementById("header-stardate").textContent = "STARDATE " + stardate;

  buildTree();
  renderPage(current());
})();
