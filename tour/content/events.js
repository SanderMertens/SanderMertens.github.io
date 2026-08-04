window.TOUR = window.TOUR || { structures: [] };

TOUR.structures.push({
  id: 'observable',
  name: 'Observable',
  cname: 'ecs_observable_t',
  loc: 'src/observable.c',
  group: 'EVENTS',
  summary: 'The event dispatch index: event → id → observer sets, with Bloom-filtered lookups and graph-aware propagation.',
  tagline: 'Every add, remove and set flows through here. The design goal: a world with no observers pays almost nothing.',
  sections: [
    { title: 'The Two-Level Index', html: `
      <p>Dispatch is a two-level lookup: the <b>event record</b> (one per event kind &mdash; the six builtins OnAdd/OnRemove/OnSet/Wildcard/OnTableCreate/OnTableDelete are inlined by value and resolved with a branch, custom events go through a sparse set) and inside it, per observed id, an <b>event-id record</b> holding three observer maps: <code>self</code>, <code>self_up</code> and <code>up</code> &mdash; corresponding to the term’s traversal flags. <code>up</code>-only observers never fire from plain emits; they only fire through propagation, when the event reaches an entity indirectly.</p>
      <p>Cheap rejection is layered in front of everything: each event record keeps a 64-bit <b>Bloom filter</b> over its observed ids, tested before the map; the three hot ids (<code>Any</code>, <code>Wildcard</code>, <code>(*,*)</code>) get dedicated pointer slots; and tables carry <code>EcsTableHasOnAdd/OnRemove/OnSet</code> flags so the storage skips calling emit entirely when no observer could match. Observer registration is what sets those flags &mdash; retroactively patching existing tables and [[table-graph]] edges &mdash; which is precisely why observers cost nothing until one exists.</p>` },
    { title: 'Emit: One Event, Five Lookups', diagram: `
<svg viewBox="0 0 880 360" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-ob" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="30" y="30" width="280" height="60" rx="10" fill="#241c10" stroke="#ff9c00" stroke-width="1.5"/>
  <text x="170" y="55" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-mono">emit(OnAdd, (Likes, Alice))</text>
  <text x="170" y="76" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">ticket = ++world-&gt;event_id</text>
  <path d="M 310 60 L 370 60" stroke="#ff9c00" fill="none" marker-end="url(#m-ob)"/>
  <rect x="374" y="20" width="230" height="88" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="489" y="44" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-label">EVENT RECORD (OnAdd)</text>
  <text x="394" y="66" fill="#e8d9bd" font-size="11" class="svg-mono">bloom &amp; (1 &lt;&lt; id%64) ?</text>
  <text x="394" y="86" fill="#b9a17c" font-size="10.5" class="svg-label">no bit &rarr; nobody observes it, done</text>
  <path d="M 604 60 L 664 60" stroke="#ff9c00" fill="none" marker-end="url(#m-ob)"/>
  <rect x="668" y="20" width="182" height="88" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="759" y="44" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">UP TO 5 ID RECORDS</text>
  <text x="688" y="64" fill="#e8d9bd" font-size="10.5" class="svg-mono">Any &middot; (Likes,Alice)</text>
  <text x="688" y="80" fill="#e8d9bd" font-size="10.5" class="svg-mono">(*,Alice) &middot; (Likes,*)</text>
  <text x="688" y="96" fill="#e8d9bd" font-size="10.5" class="svg-mono">(*,*)</text>
  <rect x="30" y="150" width="390" height="80" rx="10" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="225" y="176" text-anchor="middle" fill="#a8e69a" font-size="12.5" class="svg-label">DISPATCH: invoke self + self_up maps</text>
  <text x="225" y="198" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">per matching id record — this is why a (Likes, *) observer</text>
  <text x="225" y="216" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">fires for a concrete (Likes, Alice) event</text>
  <rect x="460" y="150" width="390" height="80" rx="10" fill="#1d1430" stroke="#cc99cc"/>
  <text x="655" y="176" text-anchor="middle" fill="#e8c8e8" font-size="12.5" class="svg-label">THEN: wildcard-event pass</text>
  <text x="655" y="198" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">observers subscribed to ALL events get a second dispatch</text>
  <text x="655" y="216" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">with the same event ticket (no double-fire)</text>
  <rect x="30" y="270" width="820" height="66" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="296" fill="#cc99cc" font-size="12" class="svg-label">ZERO-ALLOCATION</text>
  <text x="200" y="296" fill="#e8d9bd" font-size="12" class="svg-label">the emit iterator lives entirely on the stack: single-field arrays, no heap touch per event.</text>
  <text x="200" y="318" fill="#e8d9bd" font-size="12" class="svg-label">Deferring is force-enabled during dispatch so observers can safely mutate the world — their ops queue.</text>
</svg>`,
      caption: 'A concrete pair event fans out to up to five id records: the exact id, both single wildcards, the double wildcard, and Any.' },
    { title: 'Propagation: Events Travel the Graph', html: `
      <p>Relationships make events non-local, in both directions:</p>
      <p><b>Upward forwarding.</b> Adding <code>(IsA, base)</code> or <code>(ChildOf, parent)</code> makes every component reachable through the target visible to the entity &mdash; so observers with <code>up</code> terms must hear about all of them. The walk up the graph is memoized in the pair record’s <b>reachable cache</b>: a flattened list of (source, id) pairs reachable through the relationship. Invalidation is a generation bump (O(1), never touches the vector); rebuilds happen lazily and mask shadowed components (a derived table that owns an id hides the base’s copy). Forwarding also fires <b>OnSet</b> for inherited components with data &mdash; that is how adding an IsA pair produces OnSet events for everything the instance just inherited.</p>
      <p><b>Downward propagation.</b> When a component changes on an entity that others traverse through (a parent, a prefab base), the event must reach descendants. The entry check is O(1): only entities with the <code>IsTraversable</code> [[record]] flag &mdash; tracked per-table by a counter &mdash; trigger it. Propagation walks the <code>trav</code> list on the <code>(*, target)</code> [[component-record]] (only traversable relationships are on it), invalidates reachable caches along the way, and recurses through grandchildren. Deep hierarchies avoid O(n&sup2;) invalidation because an already-invalid subtree is skipped.</p>` },
    { title: 'Event Tickets', html: `
      <p>Every emit takes a ticket from <code>++world->event_id</code>. Observers record the last ticket they handled and skip duplicates &mdash; essential because one logical event can reach the same observer through several paths (self, up, forwarding), and because multi-term observers have one registration per term. The ticket collapses all of it to a single invocation.</p>` },
  ],
  related: ['observer', 'component-record', 'record', 'commands', 'world'],
});

TOUR.structures.push({
  id: 'observer',
  name: 'Observer',
  cname: 'ecs_observer_t',
  loc: 'src/observer.c',
  group: 'EVENTS',
  summary: 'A callback bound to events plus a query: single-term observers dispatch directly; multi-term ones re-evaluate the full query per event.',
  tagline: 'The reactive half of flecs. The machinery scales down: a simple observer is a map entry and a function pointer.',
  sections: [
    { title: 'Registration', html: `
      <p>An observer subscribes to up to 8 events for the ids of its query terms. Each single-term registration lands in one of the three maps on the [[observable|event-id record]] &mdash; <code>self</code>, <code>self_up</code> or <code>up</code> &mdash; chosen by the term’s traversal flags. Registration side effects are where the real design lives: the <b>first</b> observer for an (event, id) sets the event flag on the [[component-record]], patches <code>EcsTableHasOnAdd/...</code> onto every existing table, and materializes diffs on trivial [[table-graph]] edges. Some rewrites happen here too: a <code>Not</code> term inverts its event (OnAdd&nbsp;&hArr;&nbsp;OnRemove &mdash; &ldquo;stopped matching&rdquo; is the remove of the negated id), and OnSet on a tag downgrades to OnAdd, since tags carry no value.</p>
      <p>Trivial single-term observers (plain self-matching term) don’t even get a query object &mdash; just a registered id and a callback. The full query machinery only materializes when terms demand it.</p>` },
    { title: 'Multi-Term Observers: The Last-Term Trick', diagram: `
<svg viewBox="0 0 880 330" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-mo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="30" y="30" width="360" height="64" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="210" y="56" text-anchor="middle" fill="#cc99cc" font-size="13" class="svg-label">PARENT OBSERVER</text>
  <text x="210" y="78" text-anchor="middle" fill="#e8c8e8" font-size="12" class="svg-mono">OnAdd: Position, Velocity</text>
  <rect x="60" y="140" width="140" height="56" rx="8" fill="#0d1420" stroke="#99ccff"/>
  <text x="130" y="163" text-anchor="middle" fill="#99ccff" font-size="11.5" class="svg-mono">child: Position</text>
  <text x="130" y="182" text-anchor="middle" fill="#b9a17c" font-size="10" class="svg-label">single-term observer</text>
  <rect x="230" y="140" width="140" height="56" rx="8" fill="#0d1420" stroke="#99ccff"/>
  <text x="300" y="163" text-anchor="middle" fill="#99ccff" font-size="11.5" class="svg-mono">child: Velocity</text>
  <text x="300" y="182" text-anchor="middle" fill="#b9a17c" font-size="10" class="svg-label">single-term observer</text>
  <path d="M 150 94 L 130 136" stroke="#ff9c00" fill="none" marker-end="url(#m-mo)"/>
  <path d="M 270 94 L 300 136" stroke="#ff9c00" fill="none" marker-end="url(#m-mo)"/>
  <rect x="440" y="120" width="410 " height="96" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="460" y="146" fill="#ffcc66" font-size="12" class="svg-label">ANY CHILD FIRES &rarr;</text>
  <text x="460" y="168" fill="#e8d9bd" font-size="11.5" class="svg-label">1. dedup: same event ticket already handled? skip</text>
  <text x="460" y="188" fill="#e8d9bd" font-size="11.5" class="svg-label">2. evaluate the FULL parent query against the table</text>
  <text x="460" y="208" fill="#e8d9bd" font-size="11.5" class="svg-label">3. match &rarr; user callback, with the triggering field patched in</text>
  <rect x="30" y="240" width="820" height="66" rx="10" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="50" y="266" fill="#a8e69a" font-size="12" class="svg-label">EFFECT: the callback fires exactly when the entity STARTS matching the whole query —</text>
  <text x="50" y="288" fill="#a8e69a" font-size="12" class="svg-label">whichever component happened to arrive last completes the match and triggers it. Adding Position to an entity that already has Velocity fires; the reverse order fires too, once.</text>
</svg>`,
      caption: 'One child observer per term; each child re-tests the whole query. The event ticket prevents double-firing when one event satisfies several terms.' },
    { title: 'Special Forms', members: [
      { name: 'Monitors', type: 'EcsMonitor', desc: 'Fire on <i>transitions</i>: the query is evaluated against both the new and the old table. Entered the match set &rarr; OnAdd-flavored callback; left it &rarr; OnRemove-flavored. Already matching before? No call.', notes: 'Monitors are always multi-term observers internally, because the before/after evaluation needs the multi-observer machinery. They register for both OnAdd and OnRemove.' },
      { name: 'Not terms', type: '!Component', desc: 'For evaluation, old and new tables swap roles — "now matches !Foo" means the entity moved to a table without Foo. A companion query with Not relaxed to Optional populates the callback’s field data from the table the entity left.' },
      { name: 'yield_existing', type: 'desc flag', desc: 'On creation, replays the observer over everything that already matches (and optionally again on deletion) — wrapped in a defer scope, with a fresh event ticket per result so dedup works.' },
      { name: 'run vs callback', type: 'two entry points', desc: 'A <code>run</code> handler receives the raw iterator plus a synthetic <code>next</code> that fires once, so the standard iteration loop works; <code>callback</code> is invoked per result directly.' },
    ]},
    { title: 'Safety', html: `
      <p>Observers run in the middle of structural changes, so two guards apply. Deferring is force-enabled during dispatch: mutations from observer code queue into the [[commands|command buffer]] rather than recursing into the half-updated storage. And the observer maps are iteration-guarded: creating an observer <i>from</i> an observer asserts (&ldquo;observer list modified while notifying&rdquo;) &mdash; removal of the current entry is the one permitted mutation.</p>` },
  ],
  related: ['observable', 'query', 'component-record', 'commands', 'type-info'],
});

TOUR.structures.push({
  id: 'on-delete',
  name: 'Deletion Cleanup',
  cname: 'on_delete / ecs_marked_id_t',
  loc: 'src/on_delete.c',
  group: 'EVENTS',
  summary: 'What happens when an entity used as a component, relationship or target dies: policy-driven, two-phase, cycle-safe cleanup.',
  tagline: 'Deleting a plain entity is one table op. Deleting an entity something depends on cascades — governed by OnDelete policies.',
  sections: [
    { title: 'Policies', html: `
      <p>Every id can declare what happens when it, or its pair target, is deleted &mdash; stored as flag bits on the [[component-record]]:</p>
      <ul>
        <li><b>(OnDelete, Remove)</b> &mdash; the default: strip the id from every entity that has it.</li>
        <li><b>(OnDelete, Delete)</b> &mdash; delete every entity that has it.</li>
        <li><b>(OnDelete, Panic)</b> &mdash; abort: the id must not be deleted while in use.</li>
        <li><b>(OnDeleteTarget, ...)</b> &mdash; the same three, triggered when a <i>pair target</i> dies. <code>(OnDeleteTarget, Delete)</code> on ChildOf is why deleting a parent deletes its children.</li>
      </ul>
      <p>The target flags sit exactly 3 bits above the non-target flags, so one lookup table decodes both with a shift. The [[record|record’s]] <code>IsId</code>/<code>IsTarget</code> flags gate the whole mechanism: entities without them skip it entirely.</p>` },
    { title: 'Two Phases', diagram: `
<svg viewBox="0 0 880 350" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-od" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc6666"/></marker></defs>
  <rect x="30" y="30" width="400" height="140" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="230" y="56" text-anchor="middle" fill="#cc99cc" font-size="13" class="svg-label">PHASE 1: MARK</text>
  <text x="50" y="82" fill="#e8d9bd" font-size="11.5" class="svg-label">depth-first from the deleted entity:</text>
  <text x="50" y="102" fill="#e8d9bd" font-size="11.5" class="svg-mono">mark e, (e, *), (*, e), (Flag, e)</text>
  <text x="50" y="122" fill="#e8d9bd" font-size="11.5" class="svg-label">Delete policy &rarr; recurse into every entity in</text>
  <text x="50" y="140" fill="#e8d9bd" font-size="11.5" class="svg-label">affected tables (skipping non-Id/non-Target ones)</text>
  <text x="50" y="160" fill="#b9a17c" font-size="10.5" class="svg-label">"already marked" check breaks cycles</text>
  <rect x="450" y="30" width="400" height="140" rx="10" fill="#241318" stroke="#cc6666"/>
  <text x="650" y="56" text-anchor="middle" fill="#ff9c9c" font-size="13" class="svg-label">PHASE 2: EXECUTE (reverse order)</text>
  <text x="470" y="82" fill="#e8d9bd" font-size="11.5" class="svg-label">marking was depth-first, so reverse order is</text>
  <text x="470" y="100" fill="#e8d9bd" font-size="11.5" class="svg-label">topological: children die before parents</text>
  <text x="470" y="124" fill="#e8d9bd" font-size="11.5" class="svg-mono">Remove &rarr; move tables to type-minus-id</text>
  <text x="470" y="144" fill="#e8d9bd" font-size="11.5" class="svg-mono">Delete &rarr; clear marked tables entirely</text>
  <text x="470" y="164" fill="#b9a17c" font-size="10.5" class="svg-label">then release ids: concrete before wildcards</text>
  <path d="M 430 100 L 446 100" stroke="#cc6666" fill="none" stroke-width="1.5" marker-end="url(#m-od)"/>
  <rect x="30" y="210" width="820" height="110" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="238" fill="#ffcc66" font-size="12" class="svg-label">RE-ENTRANCY</text>
  <text x="50" y="262" fill="#e8d9bd" font-size="12" class="svg-label">OnRemove observers run during phase 2 and may call ecs_delete again. Nested calls only append to the shared</text>
  <text x="50" y="282" fill="#e8d9bd" font-size="12" class="svg-label">mark list (world-&gt;store.marked_ids) — the topmost frame loops until the list reaches a fixed point.</text>
  <text x="50" y="304" fill="#e8d9bd" font-size="12" class="svg-label">Type info of deleted components is kept alive until all destructors have run, then released.</text>
</svg>`,
      caption: 'Mark everything reachable first, then execute bottom-up. The explicit mark stack flattens what would otherwise be unbounded recursion.' },
    { title: 'Details That Matter', html: `
      <ul>
        <li><b>Marked component records are refcount-claimed</b> for the duration, so a record survives even if all its tables vanish mid-cleanup.</li>
        <li><b>Prefab guard:</b> <code>ecs_delete_with</code> / <code>ecs_remove_all</code> skip prefab tables, so bulk operations on game entities can’t damage prefabs. Only deleting the id itself (<code>force_delete</code>) overrides this.</li>
        <li><b>Wildcards released last:</b> a <code>(R, *)</code> record heads the linked list of its concrete pairs ([[component-record]]), so concrete records must be released first.</li>
        <li><b>Non-fragmenting hierarchies</b> get a fast path: a subtree whose entities are only used as EcsParent targets is deleted directly, and the ordered-children vector is detached before iterating so observers never see half-deleted sibling lists.</li>
        <li><b>Deferred:</b> like every mutation, deletion routes through the [[commands|command queue]] when the world is busy; a Delete command truncates the entity’s remaining command chain, and later commands for the dead entity are discarded (with destructors run on their payloads).</li>
      </ul>` },
  ],
  related: ['component-record', 'record', 'observable', 'commands', 'sparse-storage'],
});
