(function () {
  const T = window.TOUR;
  const byId = {};
  T.structures.forEach(s => { byId[s.id] = s; });

  const nav = document.getElementById('nav');
  const content = document.getElementById('content');

  const groups = [];
  T.structures.forEach(s => { if (!groups.includes(s.group)) groups.push(s.group); });

  function link(id, label) {
    const s = byId[id];
    const text = label || (s ? s.name : id);
    return '<a class="iref" href="#/' + id + '">' + text + '</a>';
  }

  function expand(html) {
    return html.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, id, label) => link(id, label));
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderNav(activeId) {
    let html = '';
    groups.forEach(g => {
      html += '<div class="nav-group">' + g + '</div>';
      T.structures.filter(s => s.group === g).forEach(s => {
        const cls = s.id === activeId ? 'nav-btn active' : 'nav-btn';
        html += '<a class="' + cls + '" href="#/' + s.id + '">' + s.name + '</a>';
      });
    });
    nav.innerHTML = html;
  }

  function renderMembers(members) {
    let html = '<div class="members">';
    members.forEach(m => {
      const hasNotes = !!m.notes;
      html += '<div class="member-row' + (hasNotes ? ' expandable' : '') + '">';
      html += '<div class="member-name">' + esc(m.name);
      if (m.type) html += '<span class="mtype">' + esc(m.type) + '</span>';
      html += '</div>';
      html += '<div class="member-desc">' + expand(m.desc);
      if (hasNotes) html += '<span class="expand-hint">&#9662; MORE</span>';
      html += '</div>';
      if (hasNotes) html += '<div class="member-notes">' + expand(m.notes) + '</div>';
      html += '</div>';
    });
    return html + '</div>';
  }

  function renderStruct(s) {
    let html = '<div class="struct-header">';
    html += '<div class="struct-title">' + s.name + '</div>';
    if (s.cname) html += '<div class="struct-cname">' + esc(s.cname) + '</div>';
    if (s.loc) html += '<div class="struct-loc">' + esc(s.loc) + '</div>';
    html += '</div>';
    if (s.tagline) html += '<div class="struct-tagline">' + expand(s.tagline) + '</div>';

    (s.sections || []).forEach(sec => {
      html += '<div class="section">';
      if (sec.title) html += '<div class="section-title">' + sec.title + '</div>';
      if (sec.html) html += '<div class="prose">' + expand(sec.html) + '</div>';
      if (sec.code) html += '<div class="codeblock">' + esc(sec.code) + '</div>';
      if (sec.members) html += renderMembers(sec.members);
      if (sec.diagram) {
        html += '<div class="diagram">' + sec.diagram + '</div>';
        if (sec.caption) html += '<div class="diagram-caption">' + expand(sec.caption) + '</div>';
      }
      html += '</div>';
    });

    if (s.related && s.related.length) {
      html += '<div class="section"><div class="section-title">Cross-Reference</div><div class="xlinks">';
      s.related.forEach(id => {
        const r = byId[id];
        if (r) html += '<a class="xlink" href="#/' + id + '">' + r.name + '</a>';
      });
      html += '</div></div>';
    }
    content.innerHTML = html;
    bindExpand();
  }

  function renderHome() {
    let html = '<div class="struct-header"><div class="struct-title">Systems Directory</div></div>';
    html += '<div class="struct-tagline">Select a data structure to begin the tour. ';
    html += 'Recommended entry point: the ' + link('world') + ', from which every other structure is reachable.</div>';
    if (T.home) html += '<div class="section"><div class="prose">' + expand(T.home) + '</div></div>';
    groups.forEach(g => {
      html += '<div class="section"><div class="section-title">' + g + '</div><div class="home-grid">';
      T.structures.filter(s => s.group === g).forEach(s => {
        html += '<a class="home-card" href="#/' + s.id + '">';
        html += '<div class="hc-name">' + s.name + '</div>';
        html += '<div class="hc-cname">' + esc(s.cname || '') + '</div>';
        html += '<div class="hc-sum">' + (s.summary || '') + '</div></a>';
      });
      html += '</div></div>';
    });
    content.innerHTML = html;
  }

  function bindExpand() {
    content.querySelectorAll('.member-row.expandable').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        row.classList.toggle('open');
      });
    });
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const s = byId[hash];
    renderNav(s ? s.id : null);
    if (s) renderStruct(s); else renderHome();
    document.getElementById('viewport').scrollTop = 0;
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  document.getElementById('stardate').textContent =
    'SD ' + (now.getFullYear() - 1623) + (day / 1000).toFixed(3).slice(1);
  document.getElementById('structcount').textContent = T.structures.length + ' STRUCTS';

  window.addEventListener('hashchange', route);
  route();
})();
