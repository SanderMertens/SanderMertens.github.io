window.TOUR = window.TOUR || { structures: [] };

TOUR.structures.push({
  id: 'vec',
  name: 'Vector',
  cname: 'ecs_vec_t',
  loc: 'include/flecs/datastructures/vec.h',
  group: 'FOUNDATIONS',
  summary: 'The 16-byte growable array underneath everything: element size passed per call, capacity always a power of two.',
  tagline: 'Types, queues, caches, columns — nearly every collection in flecs is one of these underneath.',
  sections: [
    { code:
`typedef struct ecs_vec_t {
    void *array;
    int32_t count;
    int32_t size;
} ecs_vec_t;` },
    { title: 'Design Choices', members: [
      { name: 'no element size stored', type: 'design', desc: 'Every operation takes the element size as a parameter (supplied by <code>_t</code> macros as <code>sizeof(T)</code>). The struct stays 16 bytes — and sanitize builds add the size back plus a type name, asserting on every call, so type confusion is caught in debug and free in release.' },
      { name: 'power-of-two growth', type: 'policy', desc: 'Capacity is always <code>next_pow_of_2</code>, minimum 2. This pairs deliberately with the [[allocators|allocator’s]] 16-byte size classes: a small set of classes serves every vector in the program, and growing within a class can be a no-op.' },
      { name: 'remove vs remove_ordered', type: 'two removals', desc: 'Default removal is swap-with-last (O(1), order-destroying); the ordered variant memmoves. Callers choose — table rows use swap-remove, ordered-children uses the memmove.' },
      { name: 'reclaim avoids realloc', type: 'shrinking', desc: 'Shrinking allocates fresh and copies, because realloc may return the same buffer for a smaller size — defeating the point of reclaiming.' },
      { name: 'typed resize', type: 'hooks-aware', desc: 'Resizing a vector of C++ objects can’t realloc either: the move hook must run per element. The hooks-aware path allocates, move-constructs the overlap, destructs the tail, constructs the growth.' },
    ]},
    { title: 'Relationship to Table Columns', html: `
      <p>Table columns are vectors <i>minus the header</i>: a column stores only <code>{data, type_info}</code>, and the count/size come from the [[table]] — all columns of a table share one length by construction. The vec API is reused on them by synthesizing a temporary <code>ecs_vec_t</code> from column + table, saving 12&ndash;16 bytes per column across tens of thousands of tables.</p>` },
  ],
  related: ['table', 'allocators', 'sparse-set'],
});

TOUR.structures.push({
  id: 'sparse-set',
  name: 'Sparse Set',
  cname: 'ecs_sparse_t',
  loc: 'include/flecs/datastructures/sparse.h',
  group: 'FOUNDATIONS',
  summary: 'Paged sparse set with payload stored inside the pages: O(1) lookup, O(1) removal, id recycling, and stable pointers.',
  tagline: 'The pattern behind the [[entity-index]], the table registry, sparse components, and the allocator’s size classes.',
  sections: [
    { title: 'Layout', diagram: `
<svg viewBox="0 0 880 330" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-ss" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <text x="30" y="32" fill="#b9a17c" font-size="12" class="svg-label">id = 133 &rarr; page 133 &gt;&gt; 6 = 2, offset 133 &amp; 63 = 5</text>
  <rect x="30" y="50" width="50" height="30" fill="#11111c" stroke="#2a2a3a"/>
  <rect x="80" y="50" width="50" height="30" fill="#11111c" stroke="#2a2a3a"/>
  <rect x="130" y="50" width="50" height="30" fill="#241c10" stroke="#ff9c00"/>
  <text x="155" y="70" text-anchor="middle" fill="#ffcc66" font-size="11" class="svg-mono">p2</text>
  <rect x="180" y="50" width="50" height="30" fill="#11111c" stroke="#2a2a3a"/>
  <text x="130" y="100" fill="#b9a17c" font-size="11" class="svg-label">pages</text>
  <path d="M 155 80 L 155 120 L 300 120" stroke="#ff9c00" fill="none" marker-end="url(#m-ss)"/>
  <rect x="304" y="90" width="270" height="110" rx="8" fill="#11111c" stroke="#99ccff"/>
  <text x="439" y="114" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-label">PAGE (64 slots)</text>
  <text x="324" y="140" fill="#e8d9bd" font-size="11.5" class="svg-mono">sparse: int32[64]  &rarr; dense idx</text>
  <text x="324" y="162" fill="#e8d9bd" font-size="11.5" class="svg-mono">data:   T[64]      &larr; payload</text>
  <text x="324" y="188" fill="#7fbf6a" font-size="10.5" class="svg-label">payload lives IN the page: stable addresses</text>
  <rect x="620" y="90" width="230" height="110" rx="8" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="735" y="114" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">DENSE ARRAY</text>
  <text x="640" y="140" fill="#e8d9bd" font-size="11" class="svg-mono">[0][alive...][dead...]</text>
  <text x="640" y="162" fill="#b9a17c" font-size="10.5" class="svg-label">count = alive boundary</text>
  <text x="640" y="182" fill="#b9a17c" font-size="10.5" class="svg-label">full 64-bit ids w/ generation</text>
  <rect x="30" y="230" width="820" height="76" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="256" fill="#ffcc66" font-size="12" class="svg-label">VS. A CLASSIC SPARSE SET</text>
  <text x="50" y="278" fill="#e8d9bd" font-size="12" class="svg-label">The textbook version packs payloads in the dense array for cache-friendly iteration — but every removal moves an element,</text>
  <text x="50" y="296" fill="#e8d9bd" font-size="12" class="svg-label">invalidating pointers. Flecs keeps payloads in the pages instead: iteration costs one indirection, pointers live forever.</text>
</svg>`,
      caption: 'Pages are calloc’d, so a zero sparse entry naturally means "never paired" — index 0 of the dense array is reserved as that sentinel.' },
    { title: 'Mechanics', members: [
      { name: 'alive/dead partition', type: 'dense array', desc: 'Same scheme as the [[entity-index]]: dense entries below <code>count</code> are alive, entries above are dead and recyclable. Removal swaps past the boundary and bumps the stored generation; creation recycles from the boundary with a single increment.' },
      { name: 'page size 64', type: 'vs 1024', desc: 'Generic sparse sets use 64-element pages where the entity index uses 1024 — entities are numerous and dense, so bigger pages amortize; component-record sparse data is often sparse, so smaller pages waste less.', notes: 'The entity index also drops the per-page sparse array entirely: its payload (the record) carries its own dense index, saving the indirection.' },
      { name: 'users', type: 'who', desc: 'The world’s table registry (tables inlined in the sparse set — dense iteration over all tables), [[sparse-storage|sparse component data]], custom event records, and the [[allocators|allocator’s]] size-class table.' },
    ]},
  ],
  related: ['entity-index', 'sparse-storage', 'vec', 'allocators'],
});

TOUR.structures.push({
  id: 'map-hashmap',
  name: 'Map & Hashmap',
  cname: 'ecs_map_t / ecs_hashmap_t',
  loc: 'include/flecs/datastructures/map.h',
  group: 'FOUNDATIONS',
  summary: 'A 64-bit-key Fibonacci-hashed chained map, and a variable-key hashmap layered on top of it for strings and types.',
  tagline: 'Two layers: ecs_map_t handles 64-bit keys fast; ecs_hashmap_t adds arbitrary keys and collision handling for names and table types.',
  sections: [
    { title: 'ecs_map_t', html: `
      <p>Separate chaining with 24-byte entries (<code>key, value, next</code> &mdash; all 64-bit), block-allocated. The hash is <b>Fibonacci hashing</b>: multiply the key by 2<sup>64</sup>/&phi; and take the <i>high</i> bits by shifting. One multiply, one shift, no modulo &mdash; and taking high bits distributes sequential keys (entity ids!) well, which a plain mask would not. The bucket count is a power of two; the shift amount doubles as the &ldquo;is initialized&rdquo; sentinel.</p>
      <p>Growth targets roughly 0.8 entries per bucket; shrinking is explicit only. Rehashing relinks existing entries into the new bucket array &mdash; no per-entry allocation. Debug builds count modifications and assert if a map changes mid-iteration (the check behind &ldquo;cannot create observer from observer&rdquo;), with removal of the current entry as the one sanctioned exception.</p>` },
    { title: 'ecs_hashmap_t', html: `
      <p>For keys larger than 64 bits &mdash; strings, whole id arrays &mdash; the hashmap wraps a map from <i>hash</i> to a bucket of parallel key/value vectors, resolving full-hash collisions with the user’s compare function. Its two big customers:</p>
      <ul>
        <li><b>The table map</b> ([[world|world->store.table_map]]): full sorted id array &rarr; [[table]]. This is the archetype interning index — the reason each unique type has exactly one table.</li>
        <li><b>Name indices</b>: pre-hashed strings &rarr; entities. One name index exists <i>per parent</i>, on the <code>(ChildOf, parent)</code> [[component-record]] — path lookup is a chain of per-level O(1) lookups, and sibling names in different parents never touch the same structure. The stored string pointer is borrowed, with a dedicated re-point operation for when a name’s buffer reallocates without changing content.</li>
      </ul>
      <p>Content hashing uses <b>wyhash</b> throughout.</p>` },
  ],
  related: ['world', 'table', 'component-record', 'allocators'],
});

TOUR.structures.push({
  id: 'allocators',
  name: 'Allocators',
  cname: 'ecs_block_allocator_t / ecs_stack_t',
  loc: 'src/datastructures/block_allocator.c',
  group: 'FOUNDATIONS',
  summary: 'Freelist block allocators in 16-byte size classes, plus a bump-pointer stack allocator for LIFO scratch memory.',
  tagline: 'Why flecs rarely calls malloc: stereotyped allocation patterns get stereotyped allocators — and per-[[stage]] copies make them lock-free.',
  sections: [
    { title: 'Block Allocator', diagram: `
<svg viewBox="0 0 880 300" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-ba" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="30" y="30" width="290 " height="56" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="175" y="53" text-anchor="middle" fill="#cc99cc" font-size="12.5" class="svg-label">flecs_alloc(a, 40 bytes)</text>
  <text x="175" y="74" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-mono">align to 16 &rarr; class = 48 &gt;&gt; 4 = 3</text>
  <path d="M 320 58 L 380 58" stroke="#ff9c00" fill="none" marker-end="url(#m-ba)"/>
  <rect x="384" y="30" width="200" height="56" rx="10" fill="#11111c" stroke="#99ccff"/>
  <text x="484" y="53" text-anchor="middle" fill="#99ccff" font-size="12" class="svg-label">size-class sparse set</text>
  <text x="484" y="74" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">one block allocator per class</text>
  <path d="M 584 58 L 644 58" stroke="#ff9c00" fill="none" marker-end="url(#m-ba)"/>
  <rect x="648" y="30" width="200" height="56" rx="10" fill="#241c10" stroke="#ff9c00"/>
  <text x="748" y="53" text-anchor="middle" fill="#ffcc66" font-size="12" class="svg-mono">pop freelist head</text>
  <text x="748" y="74" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">2 loads + 1 store</text>
  <text x="30" y="130" fill="#b9a17c" font-size="12" class="svg-label">a 4 KiB block, chunked into one size class:</text>
  <rect x="30" y="145" width="90" height="40" fill="#1a1a24" stroke="#5c5c6e"/>
  <text x="75" y="170" text-anchor="middle" fill="#8b8b9e" font-size="10.5" class="svg-label">block hdr</text>
  <rect x="120" y="145" width="100" height="40" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="170" y="170" text-anchor="middle" fill="#a8e69a" font-size="10.5" class="svg-mono">chunk 0</text>
  <rect x="220" y="145" width="100" height="40" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="270" y="170" text-anchor="middle" fill="#a8e69a" font-size="10.5" class="svg-mono">chunk 1</text>
  <rect x="320" y="145" width="100" height="40" fill="#0d1e12" stroke="#7fbf6a"/>
  <text x="370" y="170" text-anchor="middle" fill="#a8e69a" font-size="10.5" class="svg-mono">chunk 2</text>
  <rect x="420" y="145" width="100" height="40" fill="#11111c" stroke="#2a2a3a"/>
  <text x="470" y="170" text-anchor="middle" fill="#8b8b9e" font-size="10.5" class="svg-mono">...</text>
  <path d="M 170 185 Q 220 210 268 187" stroke="#7fbf6a" fill="none" marker-end="url(#m-ba)"/>
  <path d="M 270 185 Q 320 210 368 187" stroke="#7fbf6a" fill="none" marker-end="url(#m-ba)"/>
  <text x="560" y="172" fill="#b9a17c" font-size="11.5" class="svg-label">free chunks link through their own bytes:</text>
  <text x="560" y="190" fill="#b9a17c" font-size="11.5" class="svg-label">zero per-chunk overhead</text>
  <rect x="30" y="225" width="820" height="56" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="249" fill="#e8d9bd" font-size="12" class="svg-label">Freeing pushes the chunk back on the list; blocks return to the OS only at world teardown. Allocations of a full page</text>
  <text x="50" y="269" fill="#e8d9bd" font-size="12" class="svg-label">or more bypass to plain malloc, so growing one huge vector doesn’t permanently pin a block per size class.</text>
</svg>`,
      caption: 'Same-size objects, same freelist: allocation cost collapses to a pointer pop, and same-class realloc is free (same chunk returned).' },
    { title: 'Why "free" Needs the Size', html: `
      <p>Chunks carry no header &mdash; the size class is recomputed from the size at free time. That is why every <code>flecs_free</code> in the codebase takes the size, why <code>ecs_vec_fini</code> takes the element size, and why sizes are threaded through the entire engine: 8&ndash;16 bytes of per-allocation header, multiplied by millions of small objects, was judged worth the API tax.</p>
      <p>The world keeps <b>dedicated</b> block allocators for its churn objects &mdash; graph edges, [[component-record|component records]], table diffs &mdash; and each [[stage]] carries its own set, so worker threads allocate iterator and command memory without ever contending on a lock.</p>` },
    { title: 'Stack Allocator', html: `
      <p>For strictly LIFO lifetimes &mdash; iterator scratch, [[commands|command payloads]] &mdash; a bump allocator over 1&nbsp;KiB pages. Allocation aligns and bumps a cursor; a whole region is released by restoring a cursor, one pointer write. Pages are retained and reused, so a program with steady iteration depth stops allocating entirely after warm-up.</p>
      <p>Out-of-order release is handled lazily: a cursor freed while not on top is only flagged; when the top cursor is released, the stack collapses through the run of already-freed cursors. Debug builds count outstanding cursors and diagnose leaks with a pointed message: an unterminated iteration &mdash; call <code>ecs_iter_fini</code>.</p>
      <p>An iterator’s four per-field arrays are carved from a <i>single</i> stack allocation; the whole [[commands|command queue’s]] payload arena resets in O(1) after a flush. The stack allocator is why deferring a <code>set</code> doesn’t malloc.</p>` },
  ],
  related: ['stage', 'commands', 'vec', 'sparse-set', 'iterator'],
});
