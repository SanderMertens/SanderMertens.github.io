window.TOUR = window.TOUR || { structures: [] };

TOUR.structures.push({
  id: 'entity-index',
  name: 'Entity Index',
  cname: 'ecs_entity_index_t',
  loc: 'src/storage/entity_index.h',
  group: 'STORAGE',
  summary: 'Paged sparse set mapping every entity id to its record: which table it lives in, at which row, and whether it is still alive.',
  tagline: 'The master registry: every entity id in the [[world]] resolves here, in O(1), to a stable [[record|ecs_record_t]].',
  sections: [
    { title: 'Mission', html: `
      <p>The entity index answers three questions about any 64-bit entity id, in constant time: <b>does it exist</b>, <b>is it still alive</b> (generation check), and <b>where is its data</b> (a pointer to its [[record|ecs_record_t]], which names a [[table]] and row). Every <code>ecs_get</code>, <code>ecs_add</code>, <code>ecs_has</code> and <code>ecs_is_alive</code> starts with this lookup, so its layout is dictated entirely by hot-path economics.</p>
      <p>It is a <b>paged sparse set</b>: a vector of page pointers, where each page is a fixed block of 1024 records (<code>FLECS_ENTITY_PAGE_BITS</code>&nbsp;=&nbsp;10, so a page is 1024&nbsp;&times;&nbsp;16&nbsp;bytes&nbsp;=&nbsp;16&nbsp;KiB). The lookup is a shift, a mask, and two loads &mdash; no hashing:</p>` },
    { code:
`uint32_t id = (uint32_t)entity;
int32_t page_index = (int32_t)(id >> FLECS_ENTITY_PAGE_BITS);
ecs_entity_index_page_t *page = index->pages[page_index];
ecs_record_t *r = &page->records[id & FLECS_ENTITY_PAGE_MASK];` },
    { title: 'Why Pages, Not a Flat Array', html: `
      <p>A flat <code>ecs_record_t[max_id]</code> would need reallocation whenever the id space grows &mdash; and reallocation moves records. Flecs hands out raw <code>ecs_record_t*</code> pointers everywhere (<code>ecs_ref_t</code>, observers, <code>ecs_record_find</code>), so <b>record addresses must never move</b>. With paging, only the small page-pointer vector reallocates; the 16&nbsp;KiB pages themselves stay put forever. Paging also means a world using a high id range (e.g. after <code>ecs_set_entity_range</code> for networking) doesn't pay for the billions of ids it skipped: untouched pages are simply <code>NULL</code>.</p>
      <p>Pages are allocated with <code>calloc</code>, and that zeroing is load-bearing: a record with <code>dense == 0</code> is the sentinel for &ldquo;this id was never issued&rdquo;.</p>` },
    { title: 'Structure', members: [
      { name: 'dense', type: 'ecs_vec_t<uint64_t>', desc: 'Vector of entity ids <b>including their generation</b>. Partitioned: indices <code>[1, alive_count)</code> are alive, <code>[alive_count, count)</code> are dead and recyclable. Index 0 is a reserved sentinel.', notes: 'The generation of an entity is stored <i>only</i> here, never in the record. Liveness checking therefore costs one extra load (<code>dense[r->dense] == entity</code>), and recycling an id is a single in-place write. <code>flecs_entity_index_count()</code> is <code>alive_count - 1</code> because of the sentinel slot.' },
      { name: 'pages', type: 'ecs_vec_t<page*>', desc: 'Vector of pointers to lazily-allocated 1024-record pages. A page index that was never touched holds <code>NULL</code>.' },
      { name: 'alive_count', type: 'int32_t', desc: 'The partition point in <code>dense</code>. Everything below it (except index 0) is alive; everything at or above it is a dead id waiting to be recycled.' },
      { name: 'max_id', type: 'uint32_t', desc: 'Highest entity id ever issued. When the dead partition is empty, a brand-new id is minted by incrementing this. Asserts at <code>UINT32_MAX</code> &mdash; the id space is 32 bits (see [[entity-id]]).' },
      { name: 'allocator', type: 'ecs_allocator_t*', desc: 'The [[allocators|world allocator]] used for the dense and pages vectors. Pages themselves use plain calloc so they arrive zeroed.' },
    ]},
    { title: 'Lookup Path', diagram: `
<svg viewBox="0 0 880 330" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-ei" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="20" y="20" width="300" height="44" rx="6" fill="#11111c" stroke="#2a2a3a"/>
  <rect x="20" y="20" width="130" height="44" rx="6" fill="#1d1430" stroke="#cc99cc"/>
  <text x="85" y="38" text-anchor="middle" fill="#cc99cc" font-size="11" class="svg-label">GENERATION</text>
  <text x="85" y="54" text-anchor="middle" fill="#cc99cc" font-size="11" class="svg-mono">bits 32..47</text>
  <text x="235" y="38" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-label">ENTITY NUMBER</text>
  <text x="235" y="54" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">bits 0..31</text>
  <text x="330" y="48" fill="#b9a17c" font-size="12" class="svg-label">64-bit entity id</text>
  <path d="M 200 64 L 130 120" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <path d="M 270 64 L 360 120" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <rect x="40" y="124" width="180" height="36" rx="6" fill="#11111c" stroke="#ff9c00"/>
  <text x="130" y="147" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">page = id &gt;&gt; 10</text>
  <rect x="290" y="124" width="180" height="36" rx="6" fill="#11111c" stroke="#ff9c00"/>
  <text x="380" y="147" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">offset = id &amp; 0x3FF</text>
  <path d="M 130 160 L 130 200" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <rect x="40" y="204" width="44" height="28" fill="#11111c" stroke="#2a2a3a"/>
  <rect x="84" y="204" width="44" height="28" fill="#241c10" stroke="#ff9c00"/>
  <rect x="128" y="204" width="44" height="28" fill="#11111c" stroke="#2a2a3a"/>
  <rect x="172" y="204" width="44" height="28" fill="#11111c" stroke="#2a2a3a"/>
  <text x="128" y="252" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">pages (vector of page pointers)</text>
  <path d="M 106 232 L 106 268 L 290 268" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <rect x="294" y="240" width="240" height="60" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="414" y="262" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-label">PAGE &middot; records[1024]</text>
  <text x="414" y="282" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">16 KiB, calloc'd, address never moves</text>
  <path d="M 380 160 L 380 200 L 420 236" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <path d="M 534 270 L 600 270" stroke="#ff9c00" fill="none" marker-end="url(#m-ei)"/>
  <rect x="604" y="220" width="250" height="100" rx="6" fill="#0d1420" stroke="#ff9c00"/>
  <text x="729" y="244" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-mono">ecs_record_t</text>
  <text x="620" y="268" fill="#e8d9bd" font-size="12" class="svg-mono">table  &rarr; ecs_table_t*</text>
  <text x="620" y="286" fill="#e8d9bd" font-size="12" class="svg-mono">row    &rarr; row | flag bits</text>
  <text x="620" y="304" fill="#e8d9bd" font-size="12" class="svg-mono">dense  &rarr; index in dense[]</text>
  <rect x="560" y="20" width="300" height="130" rx="6" fill="#11111c" stroke="#2a2a3a"/>
  <text x="710" y="44" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">LIVENESS CHECK</text>
  <text x="576" y="70" fill="#e8d9bd" font-size="11.5" class="svg-mono">r-&gt;dense != 0</text>
  <text x="576" y="90" fill="#e8d9bd" font-size="11.5" class="svg-mono">r-&gt;dense &lt; alive_count</text>
  <text x="576" y="110" fill="#e8d9bd" font-size="11.5" class="svg-mono">dense[r-&gt;dense] == entity</text>
  <text x="576" y="134" fill="#b9a17c" font-size="11" class="svg-label">generation lives only in the dense array</text>
</svg>`,
      caption: 'One shift, one mask, two loads: any entity id resolves to a stable record pointer. Liveness is a comparison against the dense array, where the current generation is stored.' },
    { title: 'Death &amp; Recycling', html: `
      <p>Deleting an entity does not free anything. The id is <b>swapped with the last alive entry</b> in the dense array, <code>alive_count</code> is decremented, and the generation stored in the dense slot is incremented in place (<code>ECS_GENERATION_INC</code>, wrapping at 16 bits). The dead partition is thereby an <b>implicit free list with zero extra memory</b>: creating a new entity when dead ids exist is just <code>dense[alive_count++]</code> &mdash; the pre-incremented generation comes along for free, so stale handles to the old incarnation fail the liveness comparison.</p>
      <p><code>ecs_make_alive</code> handles the rare deserialization case where a caller needs a <i>specific</i> generation to exist: it simply overwrites the stored generation in the dense slot before ensuring the id. That keeps the generation-override branch out of the hot path entirely.</p>` },
    { diagram: `
<svg viewBox="0 0 880 190" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-ei2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc6666"/></marker></defs>
  <text x="30" y="30" fill="#b9a17c" font-size="12" class="svg-label">dense array</text>
  <rect x="30" y="40" width="60" height="40" fill="#1a1a24" stroke="#5c5c6e"/>
  <text x="60" y="65" text-anchor="middle" fill="#8b8b9e" font-size="11" class="svg-label">[0]</text>
  <rect x="90" y="40" width="360" height="40" fill="#12240f" stroke="#7fbf6a"/>
  <text x="270" y="65" text-anchor="middle" fill="#a8e69a" font-size="13" class="svg-label">ALIVE ids (with current generation)</text>
  <rect x="450" y="40" width="300" height="40" fill="#2a1010" stroke="#cc6666"/>
  <text x="600" y="65" text-anchor="middle" fill="#ff9c9c" font-size="13" class="svg-label">DEAD ids (generation pre-incremented)</text>
  <text x="60" y="100" text-anchor="middle" fill="#8b8b9e" font-size="10.5" class="svg-label">sentinel</text>
  <path d="M 450 100 L 450 80" stroke="#ffcc66" fill="none"/>
  <text x="450" y="118" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">alive_count</text>
  <path d="M 500 140 Q 470 110 460 84" stroke="#cc6666" fill="none" marker-end="url(#m-ei2)"/>
  <text x="512" y="152" fill="#e8d9bd" font-size="12" class="svg-label">new entity? recycle: dense[alive_count++]</text>
  <text x="512" y="172" fill="#b9a17c" font-size="11.5" class="svg-label">delete? swap to end of alive region, alive_count--, bump generation</text>
  <text x="770" y="65" fill="#b9a17c" font-size="11.5" class="svg-label">exhausted?</text>
  <text x="770" y="80" fill="#b9a17c" font-size="11.5" class="svg-mono">++max_id</text>
</svg>`,
      caption: 'The dense array’s dead partition doubles as the id free list. Recycling an id is a single increment.' },
  ],
  related: ['record', 'entity-id', 'world', 'table', 'sparse-set'],
});

TOUR.structures.push({
  id: 'record',
  name: 'Record',
  cname: 'ecs_record_t',
  loc: 'include/flecs/private/api_internals.h',
  group: 'STORAGE',
  summary: 'The 16-byte answer to "where is this entity": table pointer, row (with flag bits packed in), and dense-array index.',
  tagline: 'Every entity has exactly one record, owned by the [[entity-index]]. It is the pivot between an id and the [[table]] holding its components.',
  sections: [
    { title: 'Mission', html: `
      <p>The record is deliberately tiny &mdash; 16 bytes, two per cache line &mdash; because it sits on the hottest path in the engine: every <code>get</code>, <code>has</code>, <code>add</code> and <code>set</code> loads one. It holds no generation (that lives in the [[entity-index]] dense array) and no component metadata (that lives on the [[table]]).</p>` },
    { code:
`struct ecs_record_t {
    ecs_table_t *table;
    uint32_t row;
    int32_t dense;
};` },
    { title: 'Members', members: [
      { name: 'table', type: 'ecs_table_t*', desc: 'The [[table]] whose type matches this entity’s set of components. All entities with the same component set share one table.' },
      { name: 'row', type: 'uint32_t', desc: 'Bits 0..27: the entity’s row in the table’s columns. Bits 28..31: entity flags (see below). Max table size is therefore 268,435,455 rows.', notes: 'Every code path that writes a row must preserve the flags: the idiom <code>r->row = ECS_ROW_TO_RECORD(row, r->row & ECS_ROW_FLAGS_MASK)</code> appears in entity creation, table moves, swap-remove deletion and row swaps. Packing flags here keeps the struct at 16 bytes with no extra load during moves.' },
      { name: 'dense', type: 'int32_t', desc: 'Index of this entity in the entity index’s dense array. Doubles as the existence sentinel: <code>dense == 0</code> means the id was never issued.' },
    ]},
    { title: 'Row Flag Bits', diagram: `
<svg viewBox="0 0 880 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="60" height="46" fill="#2a1030" stroke="#cc99cc"/>
  <rect x="90" y="30" width="60" height="46" fill="#2a1030" stroke="#cc99cc"/>
  <rect x="150" y="30" width="60" height="46" fill="#2a1030" stroke="#cc99cc"/>
  <rect x="210" y="30" width="60" height="46" fill="#2a1030" stroke="#cc99cc"/>
  <rect x="270" y="30" width="580" height="46" fill="#0d1420" stroke="#99ccff"/>
  <text x="60" y="50" text-anchor="middle" fill="#cc99cc" font-size="10" class="svg-label">31</text>
  <text x="120" y="50" text-anchor="middle" fill="#cc99cc" font-size="10" class="svg-label">30</text>
  <text x="180" y="50" text-anchor="middle" fill="#cc99cc" font-size="10" class="svg-label">29</text>
  <text x="240" y="50" text-anchor="middle" fill="#cc99cc" font-size="10" class="svg-label">28</text>
  <text x="60" y="66" text-anchor="middle" fill="#ffddaa" font-size="9.5" class="svg-label">IsId</text>
  <text x="120" y="66" text-anchor="middle" fill="#ffddaa" font-size="9.5" class="svg-label">IsTarget</text>
  <text x="180" y="66" text-anchor="middle" fill="#ffddaa" font-size="9.5" class="svg-label">IsTrav</text>
  <text x="240" y="66" text-anchor="middle" fill="#ffddaa" font-size="9.5" class="svg-label">DontFrag</text>
  <text x="560" y="60" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">TABLE ROW &middot; bits 0..27 &middot; ECS_ROW_MASK = 0x0FFFFFFF</text>
  <text x="30" y="110" fill="#ffcc66" font-size="12" class="svg-mono">EcsEntityIsId</text>
  <text x="240" y="110" fill="#dccfb4" font-size="12" class="svg-label">entity is used as a component or relationship &rarr; deletion must sweep tables</text>
  <text x="30" y="132" fill="#ffcc66" font-size="12" class="svg-mono">EcsEntityIsTarget</text>
  <text x="240" y="132" fill="#dccfb4" font-size="12" class="svg-label">entity is the target of some pair &rarr; deletion triggers (*, e) cleanup</text>
  <text x="30" y="154" fill="#ffcc66" font-size="12" class="svg-mono">EcsEntityIsTraversable</text>
  <text x="240" y="154" fill="#dccfb4" font-size="12" class="svg-label">target of a traversable relationship (ChildOf, IsA) &rarr; event propagation visits it</text>
  <text x="30" y="176" fill="#ffcc66" font-size="12" class="svg-mono">EcsEntityHasDontFragment</text>
  <text x="240" y="176" fill="#dccfb4" font-size="12" class="svg-label">entity has sparse-stored components &rarr; deletion must sweep sparse storage</text>
</svg>`,
      caption: 'Four flag bits ride along in the row field. Each is a cleanup or propagation obligation: if none are set, deleting the entity is a pure table operation.' },
    { title: 'Why These Flags Matter', html: `
      <p>Each flag is an <b>early-out license</b>. Deleting an ordinary entity only touches its table. But if the entity was ever used <i>as an id</i> (component, tag, relationship) or <i>as a target</i>, flecs must find and clean every table and pair referencing it &mdash; expensive work that the flags let it skip for the 99.9% of entities that never needed it (see [[on-delete]]).</p>
      <p><code>EcsEntityIsTraversable</code> additionally feeds a per-table counter (<code>traversable_count</code>): when an event is emitted in a table, the [[observable|event system]] only attempts propagation if the table actually contains entities that something traverses through. The counter is carried across table moves.</p>
      <p><code>EcsEntityHasDontFragment</code> closes a bookkeeping loop for [[sparse-storage|sparse components]]: their data lives outside tables, so table teardown alone would leak it. The bit makes the extra sweep O(1)-skippable for entities that never had one.</p>` },
  ],
  related: ['entity-index', 'table', 'entity-id', 'sparse-storage', 'on-delete'],
});

TOUR.structures.push({
  id: 'table',
  name: 'Table',
  cname: 'ecs_table_t',
  loc: 'src/storage/table.h',
  group: 'STORAGE',
  summary: 'The archetype: one table per unique component set, storing all matching entities in structure-of-arrays columns.',
  tagline: 'Where component data actually lives. Every unique combination of ids gets exactly one table in the [[world]]; entities sharing a type share a table, packed contiguously.',
  sections: [
    { title: 'Mission', html: `
      <p>Flecs is an <b>archetype ECS</b>: the set of ids an entity has (its <i>type</i>) determines which table stores it. A table keeps one tightly packed array per data-carrying component (structure-of-arrays), plus an array of entity ids &mdash; all sharing a single <code>count</code>/<code>size</code>. Queries iterate tables, not entities, which is why matching is cheap: match the table once, then process its rows as contiguous memory at full cache speed.</p>
      <p>The struct is split in two: hot fields inline, and an <code>ecs_table__t *_</code> pointer to infrequently accessed metadata (hash, lock, records array, bitset columns). That keeps the part touched by every operation small.</p>` },
    { code:
`struct ecs_table_t {
    uint64_t id;
    ecs_flags32_t flags;
    int16_t column_count;
    uint16_t version;
    uint64_t bloom_filter;
    ecs_flags32_t trait_flags;
    int16_t keep;
    int16_t childof_index;
    ecs_type_t type;
    ecs_data_t data;
    ecs_graph_node_t node;
    int16_t *component_map;
    int32_t *dirty_state;
    int16_t *column_map;
    ecs_table__t *_;
};` },
    { title: 'Members', members: [
      { name: 'id', type: 'uint64_t', desc: 'Table id in the world’s table sparse set. Table ids are recycled like entity ids; the id also indexes the [[world|world’s]] 256-slot table-version array used by <code>ecs_ref_t</code>.' },
      { name: 'flags', type: 'ecs_flags32_t', desc: 'Precomputed capability bits (<code>EcsTableHasCtors</code>, <code>EcsTableHasOnAdd</code>, <code>EcsTableHasIsA</code>, <code>EcsTableEmpty</code>&hellip;). Computed once at creation; every hot path branches on these instead of re-inspecting the type.', notes: 'The composite <code>EcsTableIsComplex</code> (lifecycle hooks | toggles | sparse) is the master gate: append/delete/move check it once and dispatch to a memcpy-only fast path when clear. Event bits (<code>EcsTableHasOnAdd/OnRemove/OnSet</code>) share bit positions with the component-record <code>EcsId*</code> flags, so table init can OR them in with one mask — no translation. Observer registration patches these flags (and existing graph edges) retroactively, which is what makes observers free until one actually exists.' },
      { name: 'column_count', type: 'int16_t', desc: 'Number of data columns. Less than or equal to <code>type.count</code>: tags, tag pairs, and sparse ids have no column.' },
      { name: 'version + bloom_filter', type: 'uint16_t / uint64_t', desc: 'Version bumps invalidate <code>ecs_ref_t</code> caches. The bloom filter is a one-hash 64-bit filter over the type: queries reject non-matching tables with a single AND+compare before ever touching the type array.' },
      { name: 'type', type: 'ecs_type_t', desc: 'The sorted array of ids defining this table. Sorting makes the type canonical: one unique id set &harr; one table, found by hashing this array into the world’s table map.' },
      { name: 'data', type: 'ecs_data_t', desc: 'The actual storage: <code>entities</code> array, <code>columns</code> array, IsA override cache, and the single shared <code>count</code>/<code>size</code>.', notes: 'Each <code>ecs_column_t</code> is just <code>{void *data; ecs_type_info_t *ti;}</code> — no per-column count/size/elem_size. The vector header is synthesized on demand from the table’s shared count, saving 12–16 bytes per column per table (worlds routinely have tens of thousands of tables). The [[type-info]] pointer puts size and hooks one dereference away.' },
      { name: 'node', type: 'ecs_graph_node_t', desc: 'This table’s node in the [[table-graph]]: cached add/remove edges to neighboring tables.' },
      { name: 'component_map', type: 'int16_t[256]', desc: 'Fast path for low ids (&lt; <code>FLECS_HI_COMPONENT_ID</code>): tri-state entries. 0 = not present, &gt;0 = column_index+1, &lt;0 = -(type_index+1) for tags/sparse ids.', notes: 'This is what lets <code>ecs_get</code> for a low-id component reach its data with <b>zero hash lookups</b>: record &rarr; table &rarr; <code>component_map[id]</code> &rarr; column &rarr; element. Tables with no low ids share one global read-only zero array, so empty maps cost nothing.' },
      { name: 'dirty_state', type: 'int32_t*', desc: 'Lazily allocated change-detection counters: slot 0 counts structural changes (append/delete/swap), slot <code>c+1</code> counts writes to column c. Cached queries snapshot and compare (see [[query-cache]]).', notes: 'Counters start at 1, not 0, so a freshly created query monitor (initialized to 0) always reports "changed" on first inspection. Allocated only when a query first asks for change detection on the table.' },
      { name: 'column_map', type: 'int16_t*', desc: 'Single allocation of <code>type.count + column_count</code> entries holding both directions: type index &rarr; column (or -1), and column &rarr; type index.', notes: 'Columns are dense and ordered the same as the type, which lets table-to-table moves merge two column sets with one linear sorted-merge walk instead of per-component searches.' },
      { name: '_ (ecs_table__t)', type: 'ecs_table__t*', desc: 'Cold data: type hash, iteration <code>lock</code>, <code>traversable_count</code>, cleanup <code>generation</code>, toggle-bitset columns, and the <code>records</code> array linking this table into every relevant [[component-record]] cache.', notes: 'The records array has one entry per type id plus synthesized entries: <code>(Flag, id)</code> records for cleanup traits, one <code>(R, *)</code> per distinct relationship, one <code>(*, T)</code> per distinct target, plus <code>(*)</code> and <code>(*, *)</code> — and <code>(ChildOf, 0)</code> for parentless tables, which turns "match root entities" into an O(1) index lookup instead of a negation scan. These synthesized records are what make wildcard queries enumerable without scanning.' },
    ]},
    { title: 'SoA Layout', diagram: `
<svg viewBox="0 0 880 400" xmlns="http://www.w3.org/2000/svg">
  <text x="30" y="30" fill="#b9a17c" font-size="12" class="svg-label">type (sorted ids)</text>
  <rect x="200" y="12" width="130" height="28" fill="#11111c" stroke="#99ccff"/><text x="265" y="31" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">Position</text>
  <rect x="330" y="12" width="130" height="28" fill="#11111c" stroke="#99ccff"/><text x="395" y="31" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">Velocity</text>
  <rect x="460" y="12" width="130" height="28" fill="#11111c" stroke="#5c5c6e"/><text x="525" y="31" text-anchor="middle" fill="#8b8b9e" font-size="12" class="svg-mono">Npc (tag)</text>
  <rect x="590" y="12" width="170" height="28" fill="#11111c" stroke="#5c5c6e"/><text x="675" y="31" text-anchor="middle" fill="#8b8b9e" font-size="12" class="svg-mono">(ChildOf, p)</text>
  <text x="30" y="70" fill="#b9a17c" font-size="12" class="svg-label">column_map</text>
  <rect x="200" y="52" width="130" height="26" fill="#241c10" stroke="#ff9c00"/><text x="265" y="70" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">&rarr; col 0</text>
  <rect x="330" y="52" width="130" height="26" fill="#241c10" stroke="#ff9c00"/><text x="395" y="70" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">&rarr; col 1</text>
  <rect x="460" y="52" width="130" height="26" fill="#1a1a24" stroke="#5c5c6e"/><text x="525" y="70" text-anchor="middle" fill="#8b8b9e" font-size="12" class="svg-mono">-1</text>
  <rect x="590" y="52" width="170" height="26" fill="#1a1a24" stroke="#5c5c6e"/><text x="675" y="70" text-anchor="middle" fill="#8b8b9e" font-size="12" class="svg-mono">-1</text>
  <text x="30" y="130" fill="#b9a17c" font-size="12" class="svg-label">data.entities</text>
  <rect x="200" y="112" width="90" height="28" fill="#11111c" stroke="#cc99cc"/><text x="245" y="131" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-mono">e0</text>
  <rect x="290" y="112" width="90" height="28" fill="#2a1a30" stroke="#cc99cc"/><text x="335" y="131" text-anchor="middle" fill="#e8c8e8" font-size="12" class="svg-mono">e1</text>
  <rect x="380" y="112" width="90" height="28" fill="#11111c" stroke="#cc99cc"/><text x="425" y="131" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-mono">e2</text>
  <rect x="470" y="112" width="90" height="28" fill="#11111c" stroke="#cc99cc"/><text x="515" y="131" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-mono">e3</text>
  <text x="30" y="180" fill="#b9a17c" font-size="12" class="svg-label">columns[0].data</text>
  <rect x="200" y="162" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="245" y="181" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Pos(e0)</text>
  <rect x="290" y="162" width="90" height="28" fill="#152a45" stroke="#99ccff"/><text x="335" y="181" text-anchor="middle" fill="#cde3ff" font-size="11" class="svg-mono">Pos(e1)</text>
  <rect x="380" y="162" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="425" y="181" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Pos(e2)</text>
  <rect x="470" y="162" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="515" y="181" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Pos(e3)</text>
  <text x="30" y="230" fill="#b9a17c" font-size="12" class="svg-label">columns[1].data</text>
  <rect x="200" y="212" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="245" y="231" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Vel(e0)</text>
  <rect x="290" y="212" width="90" height="28" fill="#152a45" stroke="#99ccff"/><text x="335" y="231" text-anchor="middle" fill="#cde3ff" font-size="11" class="svg-mono">Vel(e1)</text>
  <rect x="380" y="212" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="425" y="231" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Vel(e2)</text>
  <rect x="470" y="212" width="90" height="28" fill="#0d1420" stroke="#99ccff"/><text x="515" y="231" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-mono">Vel(e3)</text>
  <path d="M 335 96 L 335 108" stroke="#cc99cc" fill="none"/>
  <rect x="280" y="252" width="110" height="24" rx="12" fill="#cc99cc"/>
  <text x="335" y="269" text-anchor="middle" fill="#000" font-size="12" class="svg-label">row 1 = e1</text>
  <text x="600" y="140" fill="#e8d9bd" font-size="12" class="svg-label">one shared count/size for</text>
  <text x="600" y="158" fill="#e8d9bd" font-size="12" class="svg-label">entities + every column</text>
  <text x="600" y="190" fill="#e8d9bd" font-size="12" class="svg-label">record.row of e1 == 1</text>
  <text x="600" y="208" fill="#b9a17c" font-size="11.5" class="svg-label">same index in every array</text>
  <text x="30" y="320" fill="#b9a17c" font-size="12" class="svg-label">element address</text>
  <rect x="200" y="298" width="470" height="32" rx="6" fill="#060610" stroke="#2a2a3a"/>
  <text x="435" y="319" text-anchor="middle" fill="#cde3ff" font-size="12.5" class="svg-mono">ptr = column-&gt;data + row * column-&gt;ti-&gt;size</text>
  <text x="30" y="370" fill="#b9a17c" font-size="12" class="svg-label">tags &amp; pairs</text>
  <text x="200" y="370" fill="#dccfb4" font-size="12.5" class="svg-label">exist only in the type &mdash; membership is the data, so they cost zero bytes per entity</text>
</svg>`,
      caption: 'Structure of arrays: row i is the same index in the entity array and every column. Tags and tag pairs live only in the type.' },
    { title: 'Append, Delete, Move', html: `
      <p><b>Append</b> grows all columns in lockstep and runs constructors (or copy-constructs from an IsA base via the override cache, then fires OnSet). <b>Delete</b> is a swap-remove: the last row is moved into the hole (using <code>move_dtor</code>), and the moved entity’s [[record]] is patched, preserving its flag bits. Order within a table is therefore unstable &mdash; which is why <code>EcsOrderedChildren</code> ([[sparse-storage]]) exists for hierarchies that need stable order.</p>
      <p><b>Move</b> (the heart of add/remove) walks the source and destination column sets as a single sorted merge: shared columns are move-constructed, columns only in the destination get ctor + OnAdd hooks, columns only in the source get OnRemove + dtor. Tables whose flags show no lifecycle complexity skip all of it and memcpy. A subtle optimization: if the moved row was not the last row, the source-side destruct is skipped entirely, because the subsequent swap-remove will handle that slot anyway.</p>
      <p>During query iteration a table is <b>locked</b>; mutating a locked table asserts with a message telling you to defer. That is the mechanical link between iteration safety and the [[commands|command queue]].</p>` },
  ],
  related: ['table-graph', 'record', 'component-record', 'table-cache', 'type-info', 'world'],
});

TOUR.structures.push({
  id: 'table-graph',
  name: 'Table Graph',
  cname: 'ecs_graph_node_t / ecs_graph_edge_t',
  loc: 'src/storage/table_graph.h',
  group: 'STORAGE',
  summary: 'Cached edges between tables: add/remove of an id becomes a single edge hop instead of a hash lookup.',
  tagline: 'Tables form a graph where each edge is "this table, plus (or minus) one id". The graph turns repeated archetype moves into pointer chasing.',
  sections: [
    { title: 'Mission', html: `
      <p>Adding component <code>T</code> to an entity means moving it from its current [[table]] to the table with type <code>current + T</code>. Computing that destination from scratch &mdash; build the new sorted id array, hash it, look it up &mdash; is far too slow to do per operation. The table graph <b>memoizes</b> it: each table’s <code>node</code> caches, per id, the destination table and the precomputed diff. Steady-state <code>ecs_add</code> is: index into an edge array, follow the pointer, apply the cached diff.</p>` },
    { title: 'Edge Anatomy', members: [
      { name: 'node.add / node.remove', type: 'ecs_graph_edges_t', desc: 'Outgoing edges, one set for adds and one for removes. Each is a <code>lo</code> array + <code>hi</code> map (see below).' },
      { name: 'edges.lo', type: 'ecs_graph_edge_t[256]', desc: 'Inline edge structs indexed directly by id, for ids below <code>FLECS_HI_COMPONENT_ID</code>. Adding a low-id component is a direct array index: no hashing, no allocation.', notes: 'Low edges are also registered in the hi map — but the map entry points into the lo array. The lo array is the lookup path; the hi map is the enumeration path used when flags must be patched onto all edges or a table’s edges are torn down.' },
      { name: 'edges.hi', type: 'ecs_map_t<id, edge*>', desc: 'Map for high ids and pairs; edges individually block-allocated.' },
      { name: 'edge.from / edge.to', type: 'ecs_table_t*', desc: 'Source and cached destination table. <code>to == NULL</code> means the edge exists but was never traversed.' },
      { name: 'edge.diff', type: 'ecs_table_diff_t*', desc: 'Precomputed added/removed id lists plus hook/event flags for the transition. <b>NULL for trivial edges</b> — the overwhelmingly common case.', notes: 'An edge is trivial when it adds or removes exactly one id that is not a wildcard, not IsA/ChildOf, and triggers no hooks or events. For those, the diff is synthesized on the fly, aliasing the caller’s id pointer — a trivial edge costs 40 bytes and its traversal allocates nothing. When an OnAdd/OnRemove observer is registered later, trivial edges touching that id are retroactively materialized and flagged.' },
      { name: 'node.refs', type: 'edge header', desc: 'Head of the incoming-edge lists: one header threads two intrusive doubly-linked lists (incoming add edges on <code>next</code>, incoming remove edges on <code>prev</code>).', notes: 'Backrefs exist because edges cache raw table pointers: when a table is deleted, every edge pointing at it must be found and severed. One header, two lists — a size trick.' },
    ]},
    { title: 'Traversal', diagram: `
<svg viewBox="0 0 880 300" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-tg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker>
  <marker id="m-tg2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc6666"/></marker></defs>
  <rect x="40" y="40" width="180" height="56" rx="10" fill="#11111c" stroke="#99ccff" stroke-width="1.5"/>
  <text x="130" y="64" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">[Position]</text>
  <text x="130" y="84" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">table 42</text>
  <rect x="360" y="40" width="220" height="56" rx="10" fill="#11111c" stroke="#99ccff" stroke-width="1.5"/>
  <text x="470" y="64" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-mono">[Position, Velocity]</text>
  <text x="470" y="84" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">table 43</text>
  <rect x="680" y="40" width="170" height="56" rx="10" fill="#11111c" stroke="#99ccff" stroke-width="1.5"/>
  <text x="765" y="64" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono">[Position, Velocity,</text>
  <text x="765" y="82" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-mono"> (ChildOf, p)]</text>
  <path d="M 220 58 L 356 58" stroke="#ff9c00" fill="none" stroke-width="1.5" marker-end="url(#m-tg)"/>
  <text x="288" y="48" text-anchor="middle" fill="#ffcc66" font-size="11.5" class="svg-mono">add Velocity</text>
  <path d="M 356 80 L 220 80" stroke="#cc6666" fill="none" stroke-width="1.5" marker-end="url(#m-tg2)"/>
  <text x="288" y="98" text-anchor="middle" fill="#ff9c9c" font-size="11.5" class="svg-mono">remove Velocity</text>
  <path d="M 580 58 L 676 58" stroke="#ff9c00" fill="none" stroke-width="1.5" marker-end="url(#m-tg)"/>
  <text x="628" y="48" text-anchor="middle" fill="#ffcc66" font-size="11.5" class="svg-mono">add pair</text>
  <rect x="40" y="150" width="380" height="120" rx="8" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="60" y="176" fill="#cc99cc" font-size="12" class="svg-label">EDGE HIT (steady state)</text>
  <text x="60" y="200" fill="#e8d9bd" font-size="12" class="svg-mono">edge = &amp;node.add.lo[id]</text>
  <text x="60" y="220" fill="#e8d9bd" font-size="12" class="svg-mono">edge-&gt;to != NULL  &rarr;  done</text>
  <text x="60" y="248" fill="#b9a17c" font-size="11.5" class="svg-label">one array index + one pointer follow, zero allocation</text>
  <rect x="460" y="150" width="390" height="120" rx="8" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="480" y="176" fill="#cc99cc" font-size="12" class="svg-label">EDGE MISS (first traversal only)</text>
  <text x="480" y="198" fill="#e8d9bd" font-size="11.5" class="svg-label">1. splice id into sorted copy of type (exclusive pairs replace)</text>
  <text x="480" y="216" fill="#e8d9bd" font-size="11.5" class="svg-label">2. hash type &rarr; world table map &rarr; find or create table</text>
  <text x="480" y="234" fill="#e8d9bd" font-size="11.5" class="svg-label">3. compute diff (elided if trivial), link backrefs</text>
  <text x="480" y="256" fill="#b9a17c" font-size="11.5" class="svg-label">amortized away: next time it’s a hit</text>
</svg>`,
      caption: 'Each edge is created once, on first traversal, then serves every subsequent add/remove of that id from that table.' },
    { title: 'Edge Miss: Finding the Destination', html: `
      <p>On a miss, the destination type is built by splicing the id into a copy of the sorted type. Several traits intervene here, which is why they cost nothing at add-time later:</p>
      <ul>
        <li><b>Exclusive relationships</b> (ChildOf, or anything marked <code>Exclusive</code>): if the table already has <code>(R, old)</code>, the new pair <i>replaces</i> it in place instead of accumulating.</li>
        <li><b>IsA pairs</b> pull in auto-overridden components from the base, recursively.</li>
        <li><b>With traits</b> add their companion ids transitively.</li>
        <li><b>DontFragment components</b> short-circuit entirely: the destination is the <i>same table</i> — the component never enters a type (see [[sparse-storage]]).</li>
      </ul>
      <p>The resulting type is hashed into the world’s <code>table_map</code> (a [[map-hashmap|hashmap]] keyed by the full id array). A hit returns the existing table; a miss creates one &mdash; allocating its columns, flags, records, and registering it in every relevant [[component-record]] cache. Table creation reuses the source table’s component-record pointers for shared ids, avoiding a re-hash of every id the two types have in common.</p>
      <p>The diff for a non-trivial edge is computed once with two sorted merges (a counting pass to size the allocation exactly, then a filling pass) and stored on the edge, so hooks and events for the transition never need recomputing.</p>` },
  ],
  related: ['table', 'world', 'component-record', 'commands', 'sparse-storage'],
});

TOUR.structures.push({
  id: 'table-cache',
  name: 'Table Cache',
  cname: 'ecs_table_cache_t',
  loc: 'src/storage/table_cache.h',
  group: 'STORAGE',
  summary: 'Per-component dense array of the tables containing that component — the inverted index that makes queries fast.',
  tagline: 'Owned by each [[component-record]]: the answer to "which tables contain id X", stored as a scan-friendly dense array with a queryable-first partition.',
  sections: [
    { title: 'Mission', html: `
      <p>Queries need the inverse of what tables store. A [[table]] knows which ids it has; a query for <code>Position</code> needs <i>all tables that have Position</i>. Every [[component-record]] owns a table cache holding exactly that set, as a dense array of inlined elements &mdash; so "for each table with C" is a linear scan of contiguous memory.</p>` },
    { code:
`typedef struct ecs_table_cache_t {
    ecs_map_t index;
    ecs_vec_t records;
    int32_t queryable_count;
} ecs_table_cache_t;

typedef struct ecs_table_cache_elem_t {
    ecs_table_t *table;
    ecs_table_record_t *tr;
    int16_t column;
    int16_t index;
} ecs_table_cache_elem_t;` },
    { title: 'Design Choices', members: [
      { name: 'records', type: 'vec<elem>', desc: 'Dense array of elements. Each element <b>inlines</b> the table pointer and column even though both are reachable through <code>tr</code> — a scan touches one contiguous array and never chases the table-record pointer.' },
      { name: 'index', type: 'map<table_id, int>', desc: 'Maps table id to array position for O(1) removal. <b>Created only after the 5th element</b>: below the threshold, lookup is a linear scan.', notes: 'Most component records match only a handful of tables, so the common case never allocates a map at all. When the threshold is crossed the map is created and back-filled once.' },
      { name: 'queryable_count', type: 'int32_t', desc: 'Partition point: queryable tables are kept at the front of the array. Prefab, disabled, and internal tables sit behind it.', notes: 'Queries iterate only <code>[0, queryable_count)</code>, so "skip prefabs and disabled entities" costs zero per-table branches. Insert and remove maintain the partition with at most two swaps.' },
      { name: 'elem.tr', type: 'ecs_table_record_t*', desc: 'Points back to the table’s own record for this id: where in the type the id sits (<code>index</code>), how many times it occurs (<code>count</code>, &gt;1 for wildcards), and its column.', notes: 'The table record’s header holds a back-pointer to the owning component record — legal because the cache is the <i>first member</i> of <code>ecs_component_record_t</code>, so a cache pointer and a component-record pointer are interchangeable. A documented struct-layout pun in the source.' },
    ]},
    { title: 'The Join Structure', diagram: `
<svg viewBox="0 0 880 310" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-tc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#99ccff"/></marker></defs>
  <rect x="30" y="30" width="240" height="70" rx="10" fill="#1d1430" stroke="#cc99cc" stroke-width="1.5"/>
  <text x="150" y="58" text-anchor="middle" fill="#cc99cc" font-size="13" class="svg-label">COMPONENT RECORD</text>
  <text x="150" y="80" text-anchor="middle" fill="#e8c8e8" font-size="13" class="svg-mono">Position</text>
  <path d="M 270 65 L 330 65" stroke="#99ccff" fill="none" stroke-width="1.5" marker-end="url(#m-tc)"/>
  <text x="300" y="52" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">cache</text>
  <rect x="334" y="20" width="516" height="120" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="360" y="44" fill="#99ccff" font-size="12" class="svg-label">records (dense array)</text>
  <rect x="360" y="56" width="110" height="52" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="415" y="78" text-anchor="middle" fill="#a8e69a" font-size="11.5" class="svg-mono">table 42</text>
  <text x="415" y="96" text-anchor="middle" fill="#7fbf6a" font-size="10.5" class="svg-mono">col 0</text>
  <rect x="474" y="56" width="110" height="52" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="529" y="78" text-anchor="middle" fill="#a8e69a" font-size="11.5" class="svg-mono">table 43</text>
  <text x="529" y="96" text-anchor="middle" fill="#7fbf6a" font-size="10.5" class="svg-mono">col 0</text>
  <rect x="588" y="56" width="110" height="52" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="643" y="78" text-anchor="middle" fill="#a8e69a" font-size="11.5" class="svg-mono">table 57</text>
  <text x="643" y="96" text-anchor="middle" fill="#7fbf6a" font-size="10.5" class="svg-mono">col 2</text>
  <rect x="702" y="56" width="110" height="52" fill="#241318" stroke="#cc6666"/>
  <text x="757" y="78" text-anchor="middle" fill="#ff9c9c" font-size="11.5" class="svg-mono">prefab tbl</text>
  <text x="757" y="96" text-anchor="middle" fill="#cc6666" font-size="10.5" class="svg-mono">col 0</text>
  <path d="M 702 120 L 702 108" stroke="#ffcc66" fill="none"/>
  <text x="702" y="134" text-anchor="middle" fill="#ffcc66" font-size="11" class="svg-mono">queryable_count</text>
  <rect x="30" y="190" width="820" height="90" rx="10" fill="#11111c" stroke="#2a2a3a"/>
  <text x="50" y="216" fill="#cc99cc" font-size="12" class="svg-label">QUERY: "each table with Position"</text>
  <text x="50" y="240" fill="#e8d9bd" font-size="12.5" class="svg-label">= linear scan of the dense array, front partition only — contiguous memory, prefab/disabled tables never even visited.</text>
  <text x="50" y="262" fill="#b9a17c" font-size="12" class="svg-label">Each element already carries the column, so field pointers come straight out of the scan.</text>
</svg>`,
      caption: 'Every component record owns one of these. Tables insert themselves at creation, one entry per matching id (including wildcard entries).' },
    { title: 'Empty vs Non-Empty', html: `
      <p>Older flecs versions kept two intrusive linked lists per component record (&ldquo;tables&rdquo; and &ldquo;empty tables&rdquo;). The current design replaced both with this dense array; emptiness is now expressed as table <b>flags</b> (<code>EcsTableEmpty</code> / <code>EcsTableNotEmpty</code>) maintained on append/delete, and iterators filter on a flag mask while scanning. Cheaper insertion/removal, better locality, and it eliminated the deferred empty-table propagation queue the old design needed.</p>` },
  ],
  related: ['component-record', 'table', 'query-cache'],
});

TOUR.structures.push({
  id: 'type-info',
  name: 'Type Info',
  cname: 'ecs_type_info_t',
  loc: 'include/flecs.h',
  group: 'STORAGE',
  summary: 'Per-component size, alignment, and lifecycle hooks (ctor/dtor/copy/move and the OnAdd/OnSet/OnRemove callbacks).',
  tagline: 'What the storage layer knows about a component’s C/C++ type: how big it is and how to construct, destroy, copy and move it.',
  sections: [
    { title: 'Mission', html: `
      <p>Tables store raw bytes; type info tells them what those bytes mean operationally. One <code>ecs_type_info_t</code> exists per registered component, refcounted, stored in the [[world|world’s]] type-info map, and pointed to directly by every [[component-record]] and every table column &mdash; so hot loops read <code>column->ti->size</code> with zero lookups.</p>` },
    { code:
`struct ecs_type_info_t {
    ecs_size_t size;
    ecs_size_t alignment;
    ecs_type_hooks_t hooks;
    ecs_entity_t component;
    const char *name;
    int32_t refcount;
};` },
    { title: 'The Hook Set', members: [
      { name: 'ctor / dtor', type: 'ecs_xtor_t', desc: 'Construct raw memory / destroy a live value. If any other lifecycle hook is registered but no ctor, a zero-memset default ctor is installed automatically — the other hooks would otherwise read uninitialized memory.' },
      { name: 'copy / copy_ctor', type: 'ecs_copy_t', desc: 'Assign over a live value / construct from another value. Registering <code>copy</code> auto-derives <code>copy_ctor</code> as ctor-then-copy.' },
      { name: 'move / move_ctor', type: 'ecs_move_t', desc: 'Move-assign / move-construct. Used constantly by the storage: swap-remove deletion, column reallocation, and table-to-table moves are all move operations.' },
      { name: 'ctor_move_dtor / move_dtor', type: 'ecs_move_t', desc: 'Fused composites for the storage’s two commonest sequences: "construct destination from source, then destroy source" and "move into live destination, then destroy source".', notes: 'Derived automatically from whichever primitives exist (eight derivation cases), so the table code calls exactly one function pointer per element instead of branching on combinations. Types with no hooks fall through to plain memcpy — a trivial component costs a null check over memcpy.' },
      { name: 'on_add / on_set / on_remove', type: 'ecs_iter_action_t', desc: 'Component-level observers, invoked by the storage as rows are constructed, written, and destroyed. Their presence sets table flags (<code>EcsTableHasCtors</code> etc.), pulling the table off its fast paths only when actually needed.' },
      { name: 'on_replace / on_validate', type: 'ecs_iter_action_t', desc: 'Interception hooks: on_replace sees old and new values on assignment (the mechanism behind the non-fragmenting <code>EcsParent</code> component, see [[sparse-storage]]); on_validate can reject values.' },
      { name: 'flags', type: 'ecs_flags32_t', desc: 'Precomputed presence bits (<code>ECS_TYPE_HOOK_CTOR</code>&hellip;) plus <code>*_ILLEGAL</code> bits for types that are non-copyable/non-movable in C++; calling an illegal hook aborts with the type name.', notes: 'Hooks become immutable once the component is in use: storage decisions (table fast-path flags) are baked into tables at creation, so changing hooks afterward would desynchronize them. Attempting it fails with ECS_ALREADY_IN_USE and the old hooks are restored.' },
    ]},
    { title: 'When Hooks Fire', diagram: `
<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="260" height="200" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="160" y="56" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-label">APPEND ROW</text>
  <text x="50" y="84" fill="#e8d9bd" font-size="12" class="svg-mono">1. grow columns</text>
  <text x="50" y="106" fill="#e8d9bd" font-size="12" class="svg-mono">2. ctor</text>
  <text x="50" y="128" fill="#b9a17c" font-size="11" class="svg-label">   (or copy_ctor from IsA base)</text>
  <text x="50" y="150" fill="#e8d9bd" font-size="12" class="svg-mono">3. on_add</text>
  <text x="50" y="182" fill="#7fbf6a" font-size="11" class="svg-label">trivial table: memcpy-grow only,</text>
  <text x="50" y="198" fill="#7fbf6a" font-size="11" class="svg-label">no hook dispatch at all</text>
  <rect x="310" y="30" width="260" height="200" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="440" y="56" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-label">MOVE (add/remove id)</text>
  <text x="330" y="84" fill="#e8d9bd" font-size="12" class="svg-mono">shared col: move_ctor</text>
  <text x="330" y="106" fill="#e8d9bd" font-size="12" class="svg-mono">new col:    ctor + on_add</text>
  <text x="330" y="128" fill="#e8d9bd" font-size="12" class="svg-mono">gone col:   on_remove + dtor</text>
  <text x="330" y="160" fill="#b9a17c" font-size="11" class="svg-label">single sorted-merge walk of both</text>
  <text x="330" y="176" fill="#b9a17c" font-size="11" class="svg-label">column sets; OnRemove fires before</text>
  <text x="330" y="192" fill="#b9a17c" font-size="11" class="svg-label">the move, OnAdd/OnSet after</text>
  <rect x="590" y="30" width="260" height="200" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="720" y="56" text-anchor="middle" fill="#ffcc66" font-size="13" class="svg-label">DELETE ROW</text>
  <text x="610" y="84" fill="#e8d9bd" font-size="12" class="svg-mono">1. on_remove</text>
  <text x="610" y="106" fill="#e8d9bd" font-size="12" class="svg-mono">2. move_dtor last&rarr;hole</text>
  <text x="610" y="128" fill="#b9a17c" font-size="11" class="svg-label">   (swap-remove)</text>
  <text x="610" y="150" fill="#e8d9bd" font-size="12" class="svg-mono">3. patch moved record</text>
  <text x="610" y="182" fill="#7fbf6a" font-size="11" class="svg-label">table destruction: all on_remove</text>
  <text x="610" y="198" fill="#7fbf6a" font-size="11" class="svg-label">first, then all dtors, then index</text>
</svg>`,
      caption: 'The three storage operations and their hook sequences. Table flags computed from these hooks decide fast path vs. full dispatch once, at table creation.' },
  ],
  related: ['table', 'component-record', 'world', 'observer'],
});

TOUR.structures.push({
  id: 'sparse-storage',
  name: 'Sparse Storage',
  cname: 'DontFragment / EcsParent',
  loc: 'src/storage/sparse_storage.c',
  group: 'STORAGE',
  summary: 'Escape hatches from archetype fragmentation: components stored in per-component sparse sets, and hierarchies stored as a component value.',
  tagline: 'Not every id should split tables. Sparse and DontFragment components live outside the archetype; the [[record]] and [[component-record]] carry the bookkeeping.',
  sections: [
    { title: 'The Fragmentation Problem', html: `
      <p>Archetype storage is fast <i>because</i> each id combination gets its own [[table]] &mdash; but that is also its weakness. A pair like <code>(ChildOf, parent)</code> with 100,000 distinct parents produces 100,000 near-empty tables: iteration degrades, and every reparent is a table move. Two traits opt out:</p>
      <ul>
        <li><b><code>Sparse</code></b> &mdash; component data lives in a paged [[sparse-set]] on the [[component-record]], indexed by entity id, with stable pointers. The id still appears in the table type.</li>
        <li><b><code>DontFragment</code></b> (implies sparse) &mdash; the id <b>never enters a table type at all</b>. Adding it doesn't move the entity; the table graph returns the same table and the data goes into the component record’s sparse set.</li>
      </ul>` },
    { title: 'How DontFragment Stays Consistent', members: [
      { name: 'cr->sparse', type: 'ecs_sparse_t*', desc: 'Per-component-record sparse set holding the component data, indexed by entity id. Hooks (ctor/dtor/OnAdd/OnRemove, IsA-base copy-construction) run against it exactly as they would against a column.' },
      { name: '(R, *) wildcard record', type: 'sparse of targets', desc: 'Because DontFragment pairs are invisible to table types, "what targets does entity e have for R" needs its own index: the wildcard record’s sparse set stores, per entity, either a single target (exclusive relationships) or a sorted target list.', notes: 'Resolving a concrete value goes: wildcard record &rarr; target for entity &rarr; re-lookup the concrete (R, target) record &rarr; its sparse set. Removal maintains the target list and drops the entity when the last target goes.' },
      { name: 'EcsEntityHasDontFragment', type: 'record flag', desc: 'Bit in the entity’s [[record]] row, set on first sparse insert. Deletion sweeps the world’s linked list of non-fragmenting component records only when this bit is set — O(1) skip for everyone else.' },
      { name: 'world->cr_non_fragmenting_head', type: 'cr list', desc: 'Intrusive list of all DontFragment component records, walked on entity deletion to emit OnRemove and free sparse data.' },
    ]},
    { title: 'Non-Fragmenting Hierarchies: EcsParent', html: `
      <p><code>EcsParent</code> replaces the <code>(ChildOf, parent)</code> pair with a plain component whose <i>value</i> is the parent. All children live in the same table regardless of parent &mdash; fragmentation gone. What makes it safe is the <code>on_replace</code> [[type-info|hook]]: every write to the value is intercepted, and the hook validates the new parent is alive, checks for cycles, moves the child between the parents’ bookkeeping, fixes the name index, and updates cached depth pairs recursively. Registering on_replace is also what forbids raw <code>ensure</code>/<code>emplace</code> access &mdash; the bookkeeping cannot be bypassed.</p>
      <p>Per-parent bookkeeping lives on the <code>(ChildOf, parent)</code> [[component-record]] as a map of table id &rarr; <code>{entity, count}</code>: the child count per table, with the single-child case storing the entity inline so iteration skips the table scan. Counters for disabled/prefab tables let child iteration skip filtering when both are zero.</p>
      <p><b>Ordered children</b> (<code>EcsOrderedChildren</code> trait) solves a related problem: swap-remove makes table row order unstable, so parents that need stable child order keep an explicit entity vector on the component record. Removal is an ordered O(n) memmove &mdash; order is the point. <code>ecs_set_child_order</code> validates a permutation and memcpys it in.</p>` },
    { diagram: `
<svg viewBox="0 0 880 280" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="380" height="230" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="220" y="56" text-anchor="middle" fill="#cc6666" font-size="13" class="svg-label">FRAGMENTING (ChildOf, p)</text>
  <rect x="60" y="80" width="140" height="40" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="130" y="104" text-anchor="middle" fill="#99ccff" font-size="10.5" class="svg-mono">[Pos, (ChildOf,p1)]</text>
  <rect x="230" y="80" width="140" height="40" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="300" y="104" text-anchor="middle" fill="#99ccff" font-size="10.5" class="svg-mono">[Pos, (ChildOf,p2)]</text>
  <rect x="60" y="140" width="140" height="40" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="130" y="164" text-anchor="middle" fill="#99ccff" font-size="10.5" class="svg-mono">[Pos, (ChildOf,p3)]</text>
  <rect x="230" y="140" width="140" height="40" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="300" y="164" text-anchor="middle" fill="#99ccff" font-size="10.5" class="svg-mono">[Pos, (ChildOf,p4)]</text>
  <text x="220" y="220" text-anchor="middle" fill="#ff9c9c" font-size="12" class="svg-label">one table per parent</text>
  <text x="220" y="240" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">reparent = table move</text>
  <rect x="470" y="30" width="380" height="230" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="660" y="56" text-anchor="middle" fill="#7fbf6a" font-size="13" class="svg-label">NON-FRAGMENTING EcsParent</text>
  <rect x="500" y="80" width="320" height="100" rx="6" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="660" y="102" text-anchor="middle" fill="#a8e69a" font-size="12" class="svg-mono">[Position, EcsParent]</text>
  <text x="520" y="126" fill="#e8d9bd" font-size="11" class="svg-mono">entities: c1  c2  c3  c4  c5 ...</text>
  <text x="520" y="146" fill="#e8d9bd" font-size="11" class="svg-mono">Parent:   p1  p2  p1  p3  p2 ...</text>
  <text x="520" y="166" fill="#b9a17c" font-size="10.5" class="svg-label">parent is data, not archetype</text>
  <text x="660" y="220" text-anchor="middle" fill="#a8e69a" font-size="12" class="svg-label">one table, any number of parents</text>
  <text x="660" y="240" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">reparent = value write via on_replace hook</text>
</svg>`,
      caption: 'The same hierarchy, stored two ways. EcsParent trades archetype-indexed parent lookup for zero fragmentation, with the on_replace hook keeping indices consistent.' },
  ],
  related: ['record', 'component-record', 'table', 'sparse-set', 'type-info'],
});
