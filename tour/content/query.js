window.TOUR = window.TOUR || { structures: [] };

TOUR.structures.push({
  id: 'component-record',
  name: 'Component Record',
  cname: 'ecs_component_record_t',
  loc: 'src/storage/component_index.h',
  group: 'QUERIES',
  summary: 'One record per id in use: its flags, type info, the cache of tables containing it, and the wildcard lists linking related pairs.',
  tagline: 'The hub of the inverted index. Where a [[table]] says "I contain these ids", the component record says "these tables contain me".',
  sections: [
    { title: 'Mission', html: `
      <p>Every id ever used in the [[world]] &mdash; a component, a tag, a pair like <code>(ChildOf, parent)</code> &mdash; gets exactly one component record. It concentrates everything the engine needs to know about that id: its trait <b>flags</b>, its [[type-info]], its [[table-cache]] (all tables containing it), its [[sparse-storage|sparse storage]] if it doesn’t live in tables, and &mdash; for pairs &mdash; the linked lists that make wildcard queries possible. Query iteration is fundamentally &ldquo;walk a component record’s table cache&rdquo;.</p>` },
    { code:
`struct ecs_component_record_t {
    ecs_table_cache_t cache;
    ecs_id_t id;
    ecs_flags32_t flags;
    const ecs_type_info_t *type_info;
    void *sparse;
    ecs_vec_t dont_fragment_tables;
    ecs_pair_record_t *pair;
    ecs_id_record_elem_t non_fragmenting;
    int32_t refcount;
};` },
    { title: 'Members', members: [
      { name: 'cache', type: 'ecs_table_cache_t', desc: 'The [[table-cache]]: dense array of all tables containing this id. <b>Must be the first member</b> — table records back-reference their owning component record by casting the cache pointer.' },
      { name: 'flags', type: 'ecs_flags32_t', desc: 'The id’s trait bits: OnDelete/OnDeleteTarget policies, <code>Exclusive</code>, <code>Traversable</code>, <code>PairIsTag</code>, <code>With</code>, <code>CanToggle</code>, <code>Transitive</code>, <code>Sparse</code>, <code>DontFragment</code>, <code>OrderedChildren</code>, plus event bits (<code>HasOnAdd/OnRemove/OnSet/OnTableCreate</code>&hellip;) set when observers register.', notes: 'Flags are read from the trait tags on the <i>relationship entity’s own table</i> (<code>table->trait_flags</code>) — traits are baked into the relationship’s archetype, so deriving flags is one load. Concrete pairs <code>(R, T)</code> inherit their flags from the <code>(R, *)</code> parent record at creation, which is how a trait set on a relationship automatically applies to every pair using it. The event bits are copied into table flags at table creation (same bit positions, one OR).' },
      { name: 'type_info', type: 'const ecs_type_info_t*', desc: 'Cached [[type-info]] pointer; NULL for tags. For pairs, resolves the "which element carries the data" rule: the first element, unless it is a tag and the second is a component.' },
      { name: 'sparse', type: 'ecs_sparse_t*', desc: 'For <code>Sparse</code>/<code>DontFragment</code> ids: the component data itself, keyed by entity. For <code>(R, *)</code> DontFragment wildcards: the per-entity target index. See [[sparse-storage]].' },
      { name: 'pair', type: 'ecs_pair_record_t*', desc: 'Pair-only payload, allocated separately so plain components don’t pay for it: the per-parent name index (how <code>parent.child</code> lookup is O(1)), hierarchy depth, ordered-children vector, the reachable cache for event forwarding, and the three wildcard list links.', notes: 'The name index lives on the <code>(ChildOf, parent)</code> record — one hashmap per parent, so sibling names in different parents never share a data structure. <code>depth</code> caches the hierarchy depth for cascade-ordered queries; reparenting propagates depth changes recursively and emits <code>EcsDepthChanged</code> to invalidate affected [[query-cache|query caches]].' },
      { name: 'refcount', type: 'int32_t', desc: 'Every table containing the id holds a claim; queries and observers hold keep-alive claims. A record with tables in its cache can never be freed.' },
    ]},
    { title: 'Lookup: Array or Map', html: `
      <p>Finding a component record is the second-most-common operation after the [[entity-index]] lookup, and it uses the same trick: ids below <code>FLECS_HI_ID_RECORD_ID</code> (1024) resolve with a single array load from <code>world->id_index_lo</code>; pairs and high ids hash into <code>id_index_hi</code>. The hash strips generations and collapses <code>Any</code> onto <code>Wildcard</code> &mdash; so <code>(_, T)</code> and <code>(*, T)</code> share one record, with the semantic difference (match once vs. match each) handled by the query engine, not the storage.</p>
      <p>The seven hottest records &mdash; <code>*</code>, <code>(*,*)</code>, <code>_</code>, <code>(IsA,*)</code>, <code>(ChildOf,*)</code>, <code>(ChildOf,0)</code>, <code>(Identifier,Name)</code> &mdash; are cached as direct pointers on the [[world]] and never looked up at all.</p>` },
    { title: 'The Wildcard Lists', diagram: `
<svg viewBox="0 0 880 330" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-cr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker>
  <marker id="m-cr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc99cc"/></marker></defs>
  <rect x="40" y="30" width="170" height="54" rx="10" fill="#241c10" stroke="#ff9c00" stroke-width="1.5"/>
  <text x="125" y="53" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-mono">(Likes, *)</text>
  <text x="125" y="72" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">wildcard = list head</text>
  <rect x="290" y="30" width="170" height="54" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="375" y="53" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">(Likes, Bob)</text>
  <text x="375" y="72" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">concrete pair</text>
  <rect x="540" y="30" width="170" height="54" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="625" y="53" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">(Likes, Alice)</text>
  <text x="625" y="72" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">concrete pair</text>
  <path d="M 210 50 L 286 50" stroke="#ff9c00" fill="none" stroke-width="1.5" marker-end="url(#m-cr)"/>
  <path d="M 460 50 L 536 50" stroke="#ff9c00" fill="none" stroke-width="1.5" marker-end="url(#m-cr)"/>
  <text x="248" y="40" text-anchor="middle" fill="#ffcc66" font-size="10.5" class="svg-mono">first.next</text>
  <text x="498" y="40" text-anchor="middle" fill="#ffcc66" font-size="10.5" class="svg-mono">first.next</text>
  <rect x="40" y="140" width="170" height="54" rx="10" fill="#1d1430" stroke="#cc99cc" stroke-width="1.5"/>
  <text x="125" y="163" text-anchor="middle" fill="#e8c8e8" font-size="13" class="svg-mono">(*, Alice)</text>
  <text x="125" y="182" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">wildcard = list head</text>
  <rect x="290" y="140" width="170" height="54" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="375" y="163" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">(Likes, Alice)</text>
  <rect x="540" y="140" width="170" height="54" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="625" y="163" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">(ChildOf, Alice)</text>
  <path d="M 210 160 L 286 160" stroke="#cc99cc" fill="none" stroke-width="1.5" marker-end="url(#m-cr2)"/>
  <path d="M 460 160 L 536 160" stroke="#cc99cc" fill="none" stroke-width="1.5" marker-end="url(#m-cr2)"/>
  <text x="248" y="150" text-anchor="middle" fill="#cc99cc" font-size="10.5" class="svg-mono">second.next</text>
  <text x="498" y="150" text-anchor="middle" fill="#cc99cc" font-size="10.5" class="svg-mono">second.next</text>
  <rect x="40" y="230" width="810" height="80" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="60" y="256" fill="#cc99cc" font-size="12" class="svg-label">WHY LINKED LISTS</text>
  <text x="60" y="278" fill="#e8d9bd" font-size="12" class="svg-label">Membership changes constantly (any entity can become a target), and records must be removable in O(1) mid-iteration.</text>
  <text x="60" y="296" fill="#e8d9bd" font-size="12" class="svg-label">The links are intrusive — stored inside the pair record — so membership costs zero allocations. A third sub-list (trav) holds only traversable relationships, for event propagation.</text>
</svg>`,
      caption: 'Creating (R, T) automatically creates (R, *) and (*, T) and threads the record onto both lists. "All targets of Likes" and "all relationships pointing at Alice" are list walks.' },
    { title: 'Who Consumes the Lists', html: `
      <ul>
        <li>The query ops <code>idsr</code>/<code>idsl</code> enumerate &ldquo;all targets for <code>(R, $x)</code>&rdquo; / &ldquo;all relationships for <code>($x, T)</code>&rdquo; by walking <code>first</code>/<code>second</code>.</li>
        <li>[[observable|Event propagation]] walks the <code>trav</code> sub-list of a deleted or modified target to invalidate reachable caches and notify descendants.</li>
        <li>[[on-delete|Deletion cleanup]] of a target releases every record on its <code>second</code> list &mdash; wildcards are released last because they head the lists.</li>
      </ul>
      <p>One generic pair of insert/remove functions serves all three lists, translating &ldquo;this field in record A&rdquo; to &ldquo;the same field in record B&rdquo; via byte-offset arithmetic on the pair struct.</p>` },
  ],
  related: ['table-cache', 'table', 'query', 'sparse-storage', 'world', 'on-delete'],
});

TOUR.structures.push({
  id: 'query',
  name: 'Query',
  cname: 'ecs_query_t / ecs_query_impl_t',
  loc: 'src/query/types.h',
  group: 'QUERIES',
  summary: 'Terms compiled into a bytecode plan, evaluated by a backtracking VM — a Prolog-style solver over the component index.',
  tagline: 'From "Position, Velocity, (ChildOf, $p)" to results: terms are validated, compiled to instructions, and solved by call/redo/fail backtracking.',
  sections: [
    { title: 'Terms and Fields', html: `
      <p>A query is a list of up to 32 <b>terms</b>, each one constraint: an id to match (<code>first</code>/<code>second</code> for pairs), a <b>source</b> (the <code>$this</code> variable, a fixed entity, or a named variable like <code>$parent</code>), an operator (<code>And</code>, <code>Or</code>, <code>Not</code>, <code>Optional</code>&hellip;), an access mode (<code>in</code>/<code>out</code>/<code>inout</code>/filter), and traversal flags (<code>self</code>, <code>up</code>, <code>cascade</code> &mdash; match on the entity, or through a relationship like ChildOf/IsA). Terms map onto <b>fields</b> &mdash; the slots in the iterator output &mdash; with Or-chains collapsing into one field.</p>
      <p>Validation precomputes everything iteration will need as bitmasks on the query: which fields have fixed sources, which carry data, which are written (driving change detection), which must be read row-by-row (sparse). It also decides two crucial verdicts per term: <b>trivial</b> (plain self-matching And on <code>$this</code>) and <b>cacheable</b>. A fully trivial query bypasses the VM entirely; a fully cacheable one iterates its [[query-cache]] with no ops at all. The VM exists for everything in between.</p>` },
    { title: 'The Instruction Set', html: `
      <p>Terms compile to instructions over <b>variables</b>. The key insight: <code>$this</code> starts as a <i>table</i> variable &mdash; whole tables match at once, and results yield table ranges. Only when a term genuinely needs a single entity (pair with a shared variable, a predicate, a member comparison) does an <code>each</code> instruction demote it to an entity variable. Highlights of the op set:</p>
      <ul>
        <li><code>and</code> &mdash; the workhorse. If its source variable is already bound: <i>test</i> (does this table have the id — one [[table-cache]] map lookup). If unbound: <i>search</i> (iterate the id’s table cache). Same instruction, both behaviors, chosen at runtime from the bound-variable bitset.</li>
        <li><code>triv</code> &mdash; batch-evaluates a whole bitset of trivial terms in one instruction.</li>
        <li><code>up</code> / <code>selfup</code> / <code>trav</code> &mdash; relationship traversal, with dedicated caches; <code>tree</code>/<code>children</code> variants handle ChildOf including the non-fragmenting EcsParent storage.</li>
        <li><code>idsr</code> / <code>idsl</code> &mdash; enumerate the [[component-record]] wildcard lists: all targets of R, all relationships on T.</li>
        <li>Control flow: <code>or</code>, <code>not</code>, <code>option</code>, <code>ifvar</code> blocks; <code>each</code>, <code>store</code>, <code>lookup</code> for variables; <code>yield</code> to emit a result.</li>
      </ul>
      <p>The compiler also does <b>join ordering</b>: fixed-source terms go first (constant-cost filters that can kill the query early), and terms whose variables are already bound are compiled before terms that would open a fresh search &mdash; "evaluating known before unknown terms can significantly decrease the search space".</p>` },
    { title: 'Backtracking Evaluation', diagram: `
<svg viewBox="0 0 880 360" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-q" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#7fbf6a"/></marker>
  <marker id="m-q2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc6666"/></marker></defs>
  <text x="30" y="34" fill="#b9a17c" font-size="12" class="svg-label">plan for: Position($this), ChildOf($this, $p), Velocity($p)</text>
  <rect x="30" y="50" width="180" height="56" rx="8" fill="#11111c" stroke="#99ccff"/>
  <text x="120" y="73" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">0: and Position</text>
  <text x="120" y="93" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">search: table cache scan</text>
  <rect x="250" y="50" width="180" height="56" rx="8" fill="#11111c" stroke="#99ccff"/>
  <text x="340" y="73" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">1: and (ChildOf,*)</text>
  <text x="340" y="93" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">test; binds $p from pair</text>
  <rect x="470" y="50" width="180" height="56" rx="8" fill="#11111c" stroke="#99ccff"/>
  <text x="560" y="73" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">2: and Velocity($p)</text>
  <text x="560" y="93" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">test against $p’s table</text>
  <rect x="690" y="50" width="140" height="56" rx="8" fill="#12240f" stroke="#7fbf6a"/>
  <text x="760" y="73" text-anchor="middle" fill="#a8e69a" font-size="12" class="svg-mono">3: yield</text>
  <text x="760" y="93" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">result!</text>
  <path d="M 210 66 L 246 66" stroke="#7fbf6a" fill="none" stroke-width="1.5" marker-end="url(#m-q)"/>
  <path d="M 430 66 L 466 66" stroke="#7fbf6a" fill="none" stroke-width="1.5" marker-end="url(#m-q)"/>
  <path d="M 650 66 L 686 66" stroke="#7fbf6a" fill="none" stroke-width="1.5" marker-end="url(#m-q)"/>
  <path d="M 340 106 Q 300 150 160 130 Q 125 124 121 110" stroke="#cc6666" fill="none" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#m-q2)"/>
  <path d="M 560 106 Q 520 155 380 135 Q 345 129 341 110" stroke="#cc6666" fill="none" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#m-q2)"/>
  <text x="270" y="165" fill="#ff9c9c" font-size="11" class="svg-label">fail &rarr; jump to prev: redo previous op (next table / next pair)</text>
  <rect x="30" y="200" width="820" height="140" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="228" fill="#cc99cc" font-size="12" class="svg-label">THE ENGINE LOOP</text>
  <text x="50" y="254" fill="#e8d9bd" font-size="12.5" class="svg-mono">result = dispatch(op, redo);  next = (&amp;op-&gt;prev)[result];</text>
  <text x="50" y="278" fill="#e8d9bd" font-size="12" class="svg-label">Every op is a coroutine: first call initializes its iterator state, redo advances to the next candidate.</text>
  <text x="50" y="298" fill="#e8d9bd" font-size="12" class="svg-label">Success jumps forward (next), failure jumps backward (prev) — a branchless two-entry jump table, since prev and next are adjacent fields.</text>
  <text x="50" y="318" fill="#e8d9bd" font-size="12" class="svg-label">Backtrack past op 0 = no more results. Run past yield = a result. Per-op state persists in a flat array indexed by program counter.</text>
</svg>`,
      caption: 'Call/redo/fail — Prolog’s SLD resolution, with the component index as the fact database and tables as the unit of unification.' },
    { title: 'Written-Variable Tracking', html: `
      <p>The engine keeps a 64-bit bitset of bound variables <i>per instruction</i>, re-propagated along the taken edge on every forward jump. This is what lets one instruction be a search on one path and a test on another, and what powers <code>ifvar</code> blocks: a term using a variable that an <code>Optional</code> branch may or may not have bound is wrapped in a conditional block that checks the binding at runtime.</p>
      <p>Everything the app sees comes out of the final state: <code>$this</code>’s table range becomes <code>it->table</code>/<code>offset</code>/<code>count</code>, named variables land in <code>it->sources</code>, and matched ids/columns land in the field arrays of the [[iterator]].</p>` },
  ],
  related: ['component-record', 'query-cache', 'iterator', 'table-cache', 'table'],
});

TOUR.structures.push({
  id: 'query-cache',
  name: 'Query Cache',
  cname: 'ecs_query_cache_t',
  loc: 'src/query/cache/cache.h',
  group: 'QUERIES',
  summary: 'Materialized query results: matched tables with resolved columns, kept in sync by observers, grouped and optionally sorted.',
  tagline: 'A cached [[query]] never searches — it walks a list of pre-matched tables. The interesting part is keeping that list correct.',
  sections: [
    { title: 'Mission', html: `
      <p>Systems run every frame over the same query; re-matching tables each time is wasted work, since table&harr;query matches only change when tables are created/deleted or relationships shift. A cached query <b>materializes</b> its results: per matched table, the resolved column indices, ids, and sources are stored, and iteration is a linear walk with zero matching. The cache owns a second, derived query (uncacheable terms stripped, empty tables matched) that it uses as its matching primitive &mdash; run in &ldquo;test one table&rdquo; mode against candidates.</p>` },
    { title: 'Cache Entries', members: [
      { name: 'groups / first_group', type: 'map + ordered list', desc: 'Matched tables live in <b>groups</b>, each a vector of match elements. Without group_by there is one default group; with it, a callback computes a 64-bit group id from the table type. Cascade queries group by hierarchy depth with ordered groups — which makes iteration breadth-first, the property transform systems need.' },
      { name: 'match elements', type: 'per-table', desc: 'Per matched table: the table pointer, resolved column indices, set-field mask — and for non-trivial caches, the table records, ids, sources, up-traversal fields, and a change-detection monitor.', notes: 'Trivial caches (plain And terms, only-self, no wildcards, no sorting/change detection) store just 24 bytes per table; ids and sources arrays are shared with the query itself. Wildcard queries that match a table multiple times store extra matches in a side vector on the first match, so group vectors never contain variable-length runs — tables stay removable by swap.' },
      { name: 'tables', type: 'map<table_id, {group, index}>', desc: 'Reverse lookup from table id to its position: which group, which index. Needed for O(1) removal and rematching; stores position rather than a pointer because group vectors reallocate.' },
      { name: 'dirty_tables / dirty', type: 'vec + flag', desc: 'The rematch worklist: tables whose match state may have changed. Batched and deduplicated; drained at merges, frame boundaries, and lazily at iteration.' },
      { name: 'order_by / table_slices', type: 'sorting', desc: 'Sorted queries qsort each dirty table, then k-way merge across tables into (table, offset, count) slices representing global iteration order. Resorting is expensive, so it only happens when change detection reports actual writes.' },
    ]},
    { title: 'Staying in Sync', diagram: `
<svg viewBox="0 0 880 340" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-qc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="30" y="30" width="250" height="70" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="155" y="56" text-anchor="middle" fill="#99ccff" font-size="12.5" class="svg-label">TABLE CREATED / DELETED</text>
  <text x="155" y="78" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">OnTableCreate / OnTableDelete observer</text>
  <rect x="315" y="30" width="250" height="70" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="440" y="50" text-anchor="middle" fill="#cc99cc" font-size="12.5" class="svg-label">ANCESTOR CHANGED</text>
  <text x="440" y="70" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">component added/removed up the tree</text>
  <text x="440" y="88" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">(up-notify observer on the term id)</text>
  <rect x="600" y="30" width="250" height="70" rx="10" fill="#11111c" stroke="#cc6666"/>
  <text x="725" y="50" text-anchor="middle" fill="#ff9c9c" font-size="12.5" class="svg-label">HIERARCHY RESHAPED</text>
  <text x="725" y="70" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">EcsDepthChanged on (trav, *) / (IsA, *)</text>
  <text x="725" y="88" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">reparenting shifts depth &amp; reachability</text>
  <path d="M 155 100 L 320 160" stroke="#ff9c00" fill="none" marker-end="url(#m-qc)"/>
  <path d="M 440 100 L 440 160" stroke="#ff9c00" fill="none" marker-end="url(#m-qc)"/>
  <path d="M 725 100 L 560 160" stroke="#ff9c00" fill="none" marker-end="url(#m-qc)"/>
  <rect x="290" y="164" width="300" height="60" rx="10" fill="#241c10" stroke="#ff9c00"/>
  <text x="440" y="188" text-anchor="middle" fill="#ffcc66" font-size="12.5" class="svg-label">mark dirty (batched, deduped)</text>
  <text x="440" y="208" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">cache-&gt;dirty_tables += id &middot; world-&gt;dirty_queries += query</text>
  <path d="M 440 224 L 440 256" stroke="#ff9c00" fill="none" marker-end="url(#m-qc)"/>
  <rect x="180" y="260" width="520" height="60" rx="10" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="440" y="284" text-anchor="middle" fill="#a8e69a" font-size="12.5" class="svg-label">process at next merge / frame / iteration:</text>
  <text x="440" y="304" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">re-test each dirty table with the cache query &rarr; update, move group, or remove in place</text>
</svg>`,
      caption: 'Three observers keep the cache honest. Table events suffice for self terms; up-traversal terms need the extra two, because an ancestor can change without the child’s table changing at all.' },
    { title: 'Why Rematching Exists', html: `
      <p>For a plain <code>Position($this)</code> term, the cache can only become stale through table creation/deletion &mdash; a table’s type is immutable. But an <b>up term</b> resolves its source to an <i>ancestor entity</i>: add <code>Transform</code> to a parent, and every descendant table’s match changes without those tables being touched. Reparenting shifts both reachability and cascade depth. The rematch observers use <b>up-notify</b> registration &mdash; they only fire for entities that are actually traversal targets &mdash; so entities never used as parents or prefabs pay nothing.</p>` },
    { title: 'Change Detection', html: `
      <p>Two halves meet here. Each [[table]] keeps <b>dirty counters</b> (one per column plus one for structural changes); each cache match keeps a <b>monitor</b> &mdash; a snapshot of those counters. <code>ecs_query_changed</code> compares them; iterating a result syncs them. Writes bump the counters automatically as queries yield results with <code>out</code> fields (unless the app calls <code>ecs_iter_skip</code>). Table counters start at 1 and monitors at 0, so the first check after creation always reports changed. Registering change detection also flags the component so <code>ecs_modified</code> calls aren’t silently dropped for it.</p>` },
  ],
  related: ['query', 'table', 'table-cache', 'observer', 'world'],
});

TOUR.structures.push({
  id: 'iterator',
  name: 'Iterator',
  cname: 'ecs_iter_t',
  loc: 'include/flecs.h',
  group: 'QUERIES',
  summary: 'The universal result cursor: a table range plus per-field arrays saying where each matched component lives.',
  tagline: 'Queries, observers, systems and child iteration all speak this one protocol: next() until false, fields by index.',
  sections: [
    { title: 'Anatomy', html: `
      <p>An iterator yields <b>table ranges</b>: <code>it->table</code>, <code>offset</code>, <code>count</code>, and the <code>entities</code> array. Per query field it carries parallel arrays &mdash; <code>ids</code> (the concrete id matched, with wildcards resolved), <code>columns</code> (storage column in the iterated table, or -1), <code>sources</code> (the entity the field came from, 0 if the iterated entity itself), and <code>trs</code> (the [[table-cache|table records]] with full location info). Bitmask fields (<code>set_fields</code>, <code>up_fields</code>, <code>row_fields</code>) say which fields are populated, traversed, or need per-row access.</p>
      <p>All four arrays are carved from <b>one allocation on the stage’s stack allocator</b> &mdash; iterators are strictly LIFO, so setup is a bump and teardown is a cursor restore. For fully cached queries even that is skipped: the iterator points directly at the [[query-cache|cache element’s]] arrays, zero copies.</p>` },
    { title: 'Field Access', code:
`void* ecs_field_w_size(const ecs_iter_t *it, size_t size, int8_t index) {
    if (it->ptrs) return it->ptrs[index];
    int16_t column = it->columns[index];
    if (column >= 0) {
        return ECS_ELEM(it->table->data.columns[column].data, size, it->offset);
    }
    return flecs_field_shared(it, size, index);
}` },
    { title: 'Three Access Paths', html: `
      <ul>
        <li><b>Owned</b> (<code>columns[i] >= 0</code>): the field lives in the iterated table &mdash; pointer arithmetic on the column, the fast path systems live on.</li>
        <li><b>Shared</b> (<code>columns[i] == -1</code>, source set): the value belongs to another entity &mdash; a parent reached through <code>up</code>, a fixed-source singleton, an IsA base. Resolution chases source &rarr; record &rarr; table &rarr; column, and the pointer is one value for the whole range, not an array.</li>
        <li><b>Row fields</b> (<code>ecs_field_at</code>): sparse components have no column at all; each row is fetched from the [[component-record|component record’s]] sparse set by entity id.</li>
      </ul>
      <p>The invariant <code>columns[i] >= 0 &hArr; field owned by the iterated table</code> is maintained by every yield path and re-verified by debug assertions after each VM result.</p>` },
    { title: 'One Protocol, Many Producers', html: `
      <p><code>ecs_iter_t</code> is produced by cached walks, the [[query|query VM]], trivial searches, observers (which hand pre-filled <code>ptrs</code> to callbacks), <code>ecs_each</code>, and child iteration &mdash; the <code>next</code> function pointer selects the producer, and iterators can chain (a page or worker iterator wraps a query iterator). Observer callbacks with a <code>run</code> function even get a synthetic <code>next</code> that fires exactly once, so the same <code>while (ecs_iter_next(it))</code> loop works everywhere.</p>
      <p>Iterators also accept <b>constraints</b>: <code>ecs_iter_set_var</code> pins a variable (entity or table range) before iteration, which is how "test this one table against the query" is expressed &mdash; the mechanism behind <code>ecs_query_has</code> and the cache’s own matching primitive.</p>` },
  ],
  related: ['query', 'query-cache', 'table', 'observer', 'allocators'],
});
