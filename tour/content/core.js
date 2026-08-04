window.TOUR = window.TOUR || { structures: [] };

TOUR.home = `
  <p>This is a guided tour of the internal data structures of <b>flecs</b>, an archetype-based Entity Component System.
  Each console below decodes one structure: what it stores, why it is shaped the way it is, and how it connects to the rest of the engine.
  Blue links jump between related structures; rows marked <b>&#9662; MORE</b> expand into deeper detail.</p>`;

TOUR.structures.push({
  id: 'world',
  name: 'World',
  cname: 'ecs_world_t',
  loc: 'src/world.h',
  group: 'CORE',
  summary: 'The root object owning all ECS data: entity index, tables, component records, observers, stages, and allocators.',
  tagline: 'Everything lives here. An application can have multiple worlds; nothing is shared between them.',
  sections: [
    { title: 'Mission', html: `
      <p>The world is the container for the entire ECS: the [[entity-index]] that says where every entity lives, the [[table|tables]] that store component data, the [[component-record|component records]] that invert that mapping for queries, the [[observable|event system]], the [[stage|stages]] that make multithreading safe, and the [[allocators]] everything is carved from. Every API call starts by touching the world &mdash; so its layout is a map of what the engine considers hot.</p>` },
    { title: 'Systems Map', diagram: `
<svg viewBox="0 0 880 430" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5c73f2"/></marker></defs>
  <rect x="310" y="20" width="260" height="60" rx="14" fill="#241c10" stroke="#ff9c00" stroke-width="2"/>
  <text x="440" y="46" text-anchor="middle" fill="#ffcc66" font-size="17" class="svg-label">ecs_world_t</text>
  <text x="440" y="66" text-anchor="middle" fill="#b9a17c" font-size="11" class="svg-label">poly header &middot; flags &middot; info &middot; allocators</text>
  <rect x="30" y="140" width="190" height="72" rx="10" fill="#0d1420" stroke="#99ccff"/>
  <text x="125" y="166" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">STORE</text>
  <text x="125" y="184" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">entity index &middot; tables</text>
  <text x="125" y="199" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">table map &middot; root table</text>
  <rect x="240" y="140" width="190" height="72" rx="10" fill="#0d1420" stroke="#99ccff"/>
  <text x="335" y="166" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">COMPONENT INDEX</text>
  <text x="335" y="184" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">id_index_lo[1024]</text>
  <text x="335" y="199" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">id_index_hi map</text>
  <rect x="450" y="140" width="190" height="72" rx="10" fill="#0d1420" stroke="#99ccff"/>
  <text x="545" y="166" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">OBSERVABLE</text>
  <text x="545" y="184" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">OnAdd/OnRemove/OnSet</text>
  <text x="545" y="199" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">event &rarr; id &rarr; observers</text>
  <rect x="660" y="140" width="190" height="72" rx="10" fill="#0d1420" stroke="#99ccff"/>
  <text x="755" y="166" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">STAGES</text>
  <text x="755" y="184" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">stage 0 = main thread</text>
  <text x="755" y="199" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">1..N = workers</text>
  <path d="M 360 80 L 140 136" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 420 80 L 345 136" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 470 80 L 540 136" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 530 80 L 745 136" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <rect x="30" y="270" width="190" height="60" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="125" y="295" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">RECORDS &amp; TABLES</text>
  <text x="125" y="315" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">where entities live</text>
  <rect x="240" y="270" width="190" height="60" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="335" y="295" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">QUERIES</text>
  <text x="335" y="315" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">read the inverted index</text>
  <rect x="450" y="270" width="190" height="60" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="545" y="295" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">OBSERVERS</text>
  <text x="545" y="315" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">react to mutations</text>
  <rect x="660" y="270" width="190" height="60" rx="10" fill="#11111c" stroke="#cc99cc"/>
  <text x="755" y="295" text-anchor="middle" fill="#cc99cc" font-size="12" class="svg-label">COMMAND QUEUES</text>
  <text x="755" y="315" text-anchor="middle" fill="#b9a17c" font-size="10.5" class="svg-label">deferred mutations</text>
  <path d="M 125 212 L 125 266" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 335 212 L 335 266" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 545 212 L 545 266" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <path d="M 755 212 L 755 266" stroke="#5c73f2" fill="none" marker-end="url(#m-w)"/>
  <text x="440" y="380" text-anchor="middle" fill="#b9a17c" font-size="12" class="svg-label">merge: command queues drain back into the store at sync points</text>
  <path d="M 750 330 Q 440 420 135 334" stroke="#cc6666" fill="none" stroke-dasharray="5 4" marker-end="url(#m-w)"/>
</svg>`,
      caption: 'The world’s four pillars. Mutations either hit the store directly, or are queued per-stage and merged at sync points.' },
    { title: 'Key Members', members: [
      { name: 'hdr', type: 'ecs_header_t', desc: 'The "poly" header: a magic number (<code>0x65637377</code>, "ecsw"), refcount, and a mixin offset table. This is what lets a [[stage]] pointer be passed anywhere an <code>ecs_world_t*</code> is expected.', notes: 'Every public function calls <code>flecs_stage_from_world</code>, which checks the magic: got a real world? use stage 0. Got a stage? rewrite the caller’s world pointer to the real world and return the stage. One function makes the world/stage polymorphism work across the entire API. Freeing a poly object zeroes the magic, so use-after-free asserts loudly instead of corrupting memory.' },
      { name: 'id_index_lo / id_index_hi', type: 'cr*[1024] / map', desc: 'The component index: every id in use maps to its [[component-record]]. Ids below 1024 resolve with a single array load; pairs and high ids go through a hash (generation stripped, <code>Any</code> normalized to <code>Wildcard</code>).' },
      { name: 'cr_wildcard, cr_childof_wildcard, ...', type: 'cr* cache', desc: 'Cached pointers to the component records the engine dereferences on every structural operation: <code>*</code>, <code>(*,*)</code>, <code>_</code>, <code>(IsA,*)</code>, <code>(ChildOf,*)</code>, <code>(ChildOf,0)</code>, <code>(Identifier,Name)</code>.', notes: '<code>(ChildOf,*)</code> gets its flags stamped during bootstrap <i>before it is ever used</i> — that is how "deleting a parent deletes its children" exists before the ChildOf entity has any components. <code>(ChildOf,0)</code> is the record for root entities; teardown iterates it to find all root tables. <code>cr_non_fragmenting_head</code> heads the linked list of DontFragment components swept on entity deletion.' },
      { name: 'type_info', type: 'map<id, ti*>', desc: 'The [[type-info]] registry: size, alignment and hooks per component. Entries are heap-stable so tables and component records cache raw pointers into it.' },
      { name: 'store', type: 'ecs_store_t', desc: 'The storage core: the [[entity-index]], the sparse set of all [[table|tables]], the type&rarr;table hashmap that canonicalizes archetypes, and the <b>root table</b> (embedded by value; home of component-less entities).', notes: 'Also holds two cleanup vectors: <code>marked_ids</code>, the explicit stack that flattens recursive deletion (see [[on-delete]]), and <code>deleted_components</code>, which delays type-info destruction so destructors still see valid metadata while tables are torn down.' },
      { name: 'observable', type: 'ecs_observable_t', desc: 'The event dispatch index: per-event, per-id observer maps. See [[observable]].' },
      { name: 'event_id', type: 'int32_t', desc: 'Monotonic ticket incremented per emitted event. Observers remember the last ticket they handled, which collapses the multiple paths an event can reach an observer through (self, up, forwarded) into one invocation.' },
      { name: 'stages / stage_count', type: 'ecs_stage_t**', desc: 'The [[stage|stages]]. Stage 0 always exists and belongs to the main thread; stages 1..N-1 are created for worker threads.' },
      { name: 'table_version[256]', type: 'uint32_t[]', desc: 'Table ids hash into 256 shared counters, bumped when a table’s column memory may have moved. <code>ecs_ref_t</code> revalidates with one L1 load: if the bucket counter didn’t change, the cached component pointer is definitely still valid.', notes: 'A conservative filter: false positives possible (another table in the bucket changed), false negatives impossible. Only on a bucket mismatch does the ref fall back to checking the table’s own version.' },
      { name: 'non_trivial_lookup / non_trivial_set', type: 'uint8_t[256]', desc: 'Byte-per-low-id fast-path licenses. A zero in <code>non_trivial_lookup</code> means <code>ecs_get</code> may use the table’s component_map directly (no component-record lookup, no sparse check, no inheritance). A zero in <code>non_trivial_set</code> means <code>set</code> can skip the whole OnSet notification path.', notes: 'Registering a wildcard OnSet observer memsets the entire <code>non_trivial_set</code> array to true — one wildcard observer deliberately poisons the fast path for every low id, because correctness beats speed.' },
      { name: 'dirty_queries', type: 'vec<query*>', desc: 'Queries whose caches need rematching because inherited/traversed state changed. Processed at merges and frame boundaries. See [[query-cache]].' },
      { name: 'flags', type: 'ecs_flags32_t', desc: '<code>EcsWorldReadonly</code> (storage frozen, all mutation queues), <code>EcsWorldMultiThreaded</code>, <code>EcsWorldInit/Quit/Fini</code> lifecycle marks, <code>EcsWorldFrameInProgress</code>, and the frame/system time-measurement opt-ins.' },
      { name: 'info', type: 'ecs_world_info_t', desc: 'Metrics and frame state: delta_time (raw and scaled), accumulated frame/system/merge/rematch times, table and id counters, and an exact accounting of every command kind processed by the [[commands|command system]].' },
      { name: 'allocators / allocator', type: 'world allocators', desc: 'Six dedicated block allocators for the objects churned constantly (graph edges, component records, table diffs), plus a size-classed general allocator. See [[allocators]].' },
      { name: 'exclusive_access', type: 'thread id', desc: 'Optional thread-safety enforcement: 0 = off, a thread id = only that thread may write, UINT64_MAX = world locked. Distinct from readonly mode: readonly makes concurrent access <i>safe</i>; exclusive access makes incorrect access <i>loud</i>.' },
    ]},
    { title: 'Lifecycle: Bootstrap', html: `
      <p><code>ecs_init</code> faces a chicken-and-egg problem: flecs is implemented in terms of itself. Components are entities, but an entity needs the <code>EcsComponent</code> component to <i>be</i> a component. Bootstrap breaks the cycle by hand:</p>
      <ul>
        <li>Core ids (Component, Identifier, ChildOf, IsA, Wildcard, the builtin events&hellip;) are made alive by writing directly into the entity index and appending to the root table &mdash; bypassing all normal machinery.</li>
        <li>Type info for the first components comes from <code>sizeof</code>, since no <code>EcsComponent</code> values exist yet.</li>
        <li>The first real table <code>[EcsComponent, (Identifier,Name), (Identifier,Symbol), (ChildOf, flecs.core)]</code> is constructed manually, and the builtin components are moved into it row by row.</li>
        <li>From there the normal API works, and the rest of the builtin world &mdash; traits, events, modules &mdash; is registered through it. Traits like Exclusive, Sparse and the OnDelete policies are implemented as bootstrap observers that set flags on [[component-record|component records]] when the trait tag is added.</li>
      </ul>` },
    { title: 'Lifecycle: Teardown', html: `
      <p><code>ecs_fini</code> is a carefully ordered demolition, because user destructors run during it and must see a consistent world:</p>
      <ul>
        <li>Prefab spawners first (they keep tables alive), then observers with non-<code>$this</code> sources (their fixed sources could dangle), then root entities <b>via the public API</b> so cleanup policies still execute &mdash; targets before non-targets, to minimize table moves.</li>
        <li>Then <code>atfini</code> callbacks, then OnRemove for everything while the store is still intact, then table destruction &mdash; with table <i>types</i> freed in a separate second pass so destructors can still inspect them.</li>
        <li>Operations enqueued by destructors during teardown are collected and <b>purged</b>: payloads freed, nothing executed. Entity index, component records, and type info die last, in that order, because each holds pointers into the next.</li>
      </ul>` },
  ],
  related: ['entity-index', 'table', 'component-record', 'stage', 'observable', 'entity-id', 'allocators'],
});

TOUR.structures.push({
  id: 'entity-id',
  name: 'Entity ID',
  cname: 'ecs_entity_t / ecs_id_t',
  loc: 'include/flecs/private/api_defines.h',
  group: 'CORE',
  summary: 'The 64-bit handle: 32-bit entity number, 16-bit generation, and flag bits that turn two entities into a pair.',
  tagline: 'One integer encodes identity, liveness, and relationships. Everything the engine addresses is one of these.',
  sections: [
    { title: 'Bit Layout', diagram: `
<svg viewBox="0 0 880 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="120" height="50" fill="#2a1030" stroke="#cc99cc"/>
  <rect x="150" y="30" width="230" height="50" fill="#1a1a24" stroke="#5c5c6e"/>
  <rect x="380" y="30" width="180" height="50" fill="#241c10" stroke="#ff9c00"/>
  <rect x="560" y="30" width="290" height="50" fill="#0d1420" stroke="#99ccff"/>
  <text x="90" y="50" text-anchor="middle" fill="#cc99cc" font-size="11" class="svg-label">FLAGS</text>
  <text x="90" y="68" text-anchor="middle" fill="#cc99cc" font-size="10" class="svg-mono">63..60</text>
  <text x="265" y="50" text-anchor="middle" fill="#8b8b9e" font-size="11" class="svg-label">UNUSED</text>
  <text x="265" y="68" text-anchor="middle" fill="#8b8b9e" font-size="10" class="svg-mono">59..48</text>
  <text x="470" y="50" text-anchor="middle" fill="#ffcc66" font-size="11" class="svg-label">GENERATION</text>
  <text x="470" y="68" text-anchor="middle" fill="#ffcc66" font-size="10" class="svg-mono">47..32</text>
  <text x="705" y="50" text-anchor="middle" fill="#99ccff" font-size="11" class="svg-label">ENTITY NUMBER</text>
  <text x="705" y="68" text-anchor="middle" fill="#99ccff" font-size="10" class="svg-mono">31..0</text>
  <text x="30" y="118" fill="#ffcc66" font-size="12" class="svg-mono">ECS_PAIR          (1 &lt;&lt; 63)</text>
  <text x="380" y="118" fill="#dccfb4" font-size="12" class="svg-label">this id is a relationship pair</text>
  <text x="30" y="140" fill="#ffcc66" font-size="12" class="svg-mono">ECS_AUTO_OVERRIDE (1 &lt;&lt; 62)</text>
  <text x="380" y="140" fill="#dccfb4" font-size="12" class="svg-label">inherited via IsA &rarr; instance gets an owned copy</text>
  <text x="30" y="162" fill="#ffcc66" font-size="12" class="svg-mono">ECS_TOGGLE        (1 &lt;&lt; 61)</text>
  <text x="380" y="162" fill="#dccfb4" font-size="12" class="svg-label">refers to the component’s enable bit, not its data</text>
  <text x="30" y="184" fill="#ffcc66" font-size="12" class="svg-mono">ECS_VALUE_PAIR    (bit 60 + 63)</text>
  <text x="380" y="184" fill="#dccfb4" font-size="12" class="svg-label">pair whose second element is a value, not an entity</text>
  <rect x="30" y="212" width="820" height="70" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="238" fill="#cc99cc" font-size="12" class="svg-label">PAIR ENCODING</text>
  <text x="50" y="262" fill="#e8d9bd" font-size="12.5" class="svg-mono">ecs_pair(ChildOf, parent)  =  ECS_PAIR | (ChildOf &lt;&lt; 32) | parent</text>
  <text x="560" y="238" fill="#b9a17c" font-size="11.5" class="svg-label">two 32-bit entity numbers in one id;</text>
  <text x="560" y="256" fill="#b9a17c" font-size="11.5" class="svg-label">generations are dropped &mdash; recovered</text>
  <text x="560" y="274" fill="#b9a17c" font-size="11.5" class="svg-label">via ecs_get_alive when needed</text>
</svg>`,
      caption: 'The same 64-bit type is an entity handle, a component id, a tag, or a pair — distinguished by the top four bits.' },
    { title: 'Generations: Dangling-Handle Detection', html: `
      <p>The entity number indexes the [[entity-index]]; the generation says <i>which incarnation</i> of that slot the handle refers to. Deleting an entity increments the generation stored in the index (wrapping at 16 bits). A stale handle from generation N compares unequal to the recycled entity at generation N+1 &mdash; so <code>ecs_is_alive</code> catches dangling references with one comparison, no free-list, no tombstones.</p>
      <p>Pairs squeeze two entity numbers into the 64 bits by <b>dropping generations</b>: the relationship occupies the high half, the target the low half. That is why pair-element accessors go through <code>ecs_get_alive</code> to recover the current generation, and why the [[commands|command flush]] validates pair liveness through the entity index rather than by comparing handles.</p>` },
    { title: 'Reserved Ranges', html: `
      <ul>
        <li><b>1&ndash;7</b> &mdash; hand-bootstrapped core components (<code>EcsComponent</code>, <code>EcsIdentifier</code>&hellip;).</li>
        <li><b>8&ndash;255</b> (<code>FLECS_HI_COMPONENT_ID</code>) &mdash; the low component range. Staying here is what unlocks the engine’s array fast paths: the table’s <code>component_map</code>, the graph’s low-edge array, and the world’s non-trivial lookup bytes all index directly by id.</li>
        <li><b>256&ndash;384</b> &mdash; builtin entities, tags, traits and events.</li>
        <li><b>384+</b> &mdash; regular entities.</li>
      </ul>
      <p>The number 256 appears all over the engine because of this: it is the line between "index an array" and "hash a map".</p>` },
  ],
  related: ['entity-index', 'record', 'world', 'component-record'],
});

TOUR.structures.push({
  id: 'stage',
  name: 'Stage',
  cname: 'ecs_stage_t',
  loc: 'src/stage.h',
  group: 'CORE',
  summary: 'Per-thread context: a command queue, allocators, and scoped state, letting threads mutate the world without locks.',
  tagline: 'The unit of thread safety. Each thread writes to its own stage; the [[world]] merges them at sync points.',
  sections: [
    { title: 'Mission', html: `
      <p>Flecs achieves lock-free multithreading by <b>never sharing mutable state between threads mid-frame</b>. During system execution the world is in <i>readonly mode</i>: the storage is frozen, and every mutation a system performs is recorded into its thread’s stage instead. A stage bundles everything a thread needs to do that without touching shared memory: a [[commands|command queue]], its own [[allocators]], and thread-local context (current scope, current system, lookup path).</p>
      <p>Because a stage carries the same poly header as the world, a stage pointer <i>is</i> an <code>ecs_world_t*</code> as far as the API is concerned &mdash; system callbacks receive their stage as <code>it->world</code>, and every operation transparently routes into the right queue.</p>` },
    { title: 'Members', members: [
      { name: 'defer', type: 'int32_t', desc: 'The deferring counter: 0 = operations hit storage directly, &gt;0 = queued (refcounted nesting), &lt;0 = <b>suspended</b> — run directly against storage without losing the pending queue (used for module imports mid-frame).', notes: 'Even "non-deferred" mutations briefly enter defer mode: the operation bumps defer to 1, executes, and flushes on the way out. This is why operations triggered from within hooks and observers queue instead of recursing into storage mid-mutation.' },
      { name: 'cmd / cmd_stack[2]', type: 'ecs_commands_t', desc: 'Double-buffered command queues. Executing commands runs observers, which enqueue new commands — those land in the other buffer while the first is drained, alternating until a buffer comes back empty.', notes: '<code>cmd_flushing</code> guards re-entrancy: command execution itself uses defer scopes internally, and a nested defer_end must not start a second flush of the same stage.' },
      { name: 'scope / with / base', type: 'ecs_entity_t', desc: 'Creation context: the current parent scope for new entities, and the prefab currently being instantiated (<code>base</code> doubles as the recursion guard preventing IsA instantiation from re-entering itself).' },
      { name: 'lookup_path', type: 'entity[]', desc: 'Search path for name lookups (defaults to <code>flecs.core</code>, which is why <code>ecs_lookup(world, "ChildOf")</code> works). Propagated from stage 0 to all stages at readonly-begin.' },
      { name: 'system', type: 'ecs_entity_t', desc: 'The system currently executing on this stage. Copied into every enqueued command purely so debugging tools can answer "which system queued this".' },
      { name: 'allocators', type: 'stage allocators', desc: 'Thread-local: a stack allocator for iterator scratch (iterators are LIFO), block allocators for command entries and query objects. A worker thread never takes a lock to allocate.' },
      { name: 'thread / thread_ctx', type: 'os thread / world*', desc: '<code>thread_ctx</code> is what user code receives as its world pointer — set to the stage itself when multithreading is configured, which is the switch that routes mutations into the queue.' },
    ]},
    { title: 'The Frame', diagram: `
<svg viewBox="0 0 880 350" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-st" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff9c00"/></marker></defs>
  <rect x="30" y="30" width="820" height="50" rx="10" fill="#11111c" stroke="#2a2a3a"/>
  <text x="50" y="60" fill="#ffcc66" font-size="13" class="svg-mono">ecs_progress()</text>
  <text x="220" y="60" fill="#b9a17c" font-size="12" class="svg-label">frame_begin &rarr; run pipeline ops &rarr; frame_end</text>
  <rect x="30" y="110" width="250" height="150" rx="10" fill="#0d1420" stroke="#99ccff"/>
  <text x="155" y="136" text-anchor="middle" fill="#99ccff" font-size="13" class="svg-label">READONLY BEGIN</text>
  <text x="50" y="162" fill="#e8d9bd" font-size="11.5" class="svg-label">world flag set: storage frozen</text>
  <text x="50" y="182" fill="#e8d9bd" font-size="11.5" class="svg-label">every stage enters defer mode</text>
  <text x="50" y="210" fill="#b9a17c" font-size="11" class="svg-label">reads: safe from all threads</text>
  <text x="50" y="228" fill="#b9a17c" font-size="11" class="svg-label">writes: queue into own stage</text>
  <rect x="310" y="110" width="250" height="150" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="435" y="136" text-anchor="middle" fill="#cc99cc" font-size="13" class="svg-label">SYSTEMS RUN</text>
  <text x="330" y="164" fill="#e8d9bd" font-size="11.5" class="svg-mono">stage 0: main thread</text>
  <text x="330" y="184" fill="#e8d9bd" font-size="11.5" class="svg-mono">stage 1: worker</text>
  <text x="330" y="204" fill="#e8d9bd" font-size="11.5" class="svg-mono">stage N: worker</text>
  <text x="330" y="232" fill="#b9a17c" font-size="11" class="svg-label">no locks: each thread owns its stage</text>
  <rect x="590" y="110" width="260" height="150" rx="10" fill="#241318" stroke="#cc6666"/>
  <text x="720" y="136" text-anchor="middle" fill="#ff9c9c" font-size="13" class="svg-label">READONLY END = MERGE</text>
  <text x="610" y="162" fill="#e8d9bd" font-size="11.5" class="svg-label">flag cleared, then per stage:</text>
  <text x="610" y="182" fill="#e8d9bd" font-size="11.5" class="svg-label">flush queue &rarr; batch per entity</text>
  <text x="610" y="202" fill="#e8d9bd" font-size="11.5" class="svg-label">&rarr; one table move each</text>
  <text x="610" y="230" fill="#b9a17c" font-size="11" class="svg-label">then: rematch dirty query caches</text>
  <path d="M 280 185 L 306 185" stroke="#ff9c00" fill="none" marker-end="url(#m-st)"/>
  <path d="M 560 185 L 586 185" stroke="#ff9c00" fill="none" marker-end="url(#m-st)"/>
  <path d="M 720 260 Q 720 310 460 310 Q 155 310 155 264" stroke="#ff9c00" fill="none" stroke-dasharray="5 4" marker-end="url(#m-st)"/>
  <text x="440" y="330" text-anchor="middle" fill="#b9a17c" font-size="11.5" class="svg-label">repeat per pipeline sync point</text>
</svg>`,
      caption: 'The pipeline alternates between frozen parallel execution and single-threaded merges. Sync points are where systems observe each other’s changes.' },
    { title: 'Readonly vs Deferred', html: `
      <p>Two orthogonal mechanisms, often confused. <b>Deferred mode</b> is per-stage and refcounted: operations on that stage queue until the matching <code>defer_end</code>. <b>Readonly mode</b> is a world-global flag that additionally makes direct storage mutation an assertion failure &mdash; it <i>implies</i> deferring on every stage. Readonly is the mechanism that makes multithreaded system execution safe; deferred mode alone is a single-threaded convenience (and the reason mutations from inside observers are safe).</p>
      <p>The escape hatch is <code>flecs_suspend_readonly</code>: for operations that genuinely cannot wait (registering a component from inside a system), it swaps the stage’s entire command queue aside, zeroes the defer count, runs directly against storage, and restores everything after. The source comments it honestly: "this ought to look ugly".</p>` },
  ],
  related: ['commands', 'world', 'query-cache', 'allocators'],
});

TOUR.structures.push({
  id: 'commands',
  name: 'Command Queue',
  cname: 'ecs_cmd_t / ecs_commands_t',
  loc: 'src/commands.c',
  group: 'CORE',
  summary: 'Deferred mutations: an ordered command log with per-entity chains, batched into single table moves at flush time.',
  tagline: 'Every mutation made while the world is frozen becomes one of these. The flush replays them — but smarter than they were recorded.',
  sections: [
    { title: 'Anatomy', html: `
      <p>A [[stage]]’s command buffer is three cooperating structures: the <b>queue</b> (a flat vector of <code>ecs_cmd_t</code>, strictly in insertion order), a <b>stack allocator</b> holding command payloads (component values for <code>set</code>, copied event descriptors), and an <b>entries</b> sparse set that threads a per-entity linked list through the queue. Payloads live on the stack allocator because the whole arena is freed in O(1) when the queue drains.</p>` },
    { code:
`typedef struct ecs_cmd_t {
    ecs_cmd_kind_t kind;
    int32_t next_for_entity;
    ecs_id_t id;
    ecs_cmd_entry_t *entry;
    ecs_entity_t entity;
    union { ecs_cmd_1_t _1; ecs_cmd_n_t _n; } is;
    ecs_entity_t system;
} ecs_cmd_t;` },
    { title: 'Command Kinds', html: `
      <p>Twenty kinds, but they fall into families: structural (<code>Add</code>, <code>Remove</code>, <code>Clear</code>, <code>Delete</code>), value-carrying (<code>Set</code>, <code>Ensure</code>, <code>Emplace</code> &mdash; each with a payload on the command stack), notification (<code>Modified</code>), lifecycle (<code>Clone</code>, <code>BulkNew</code>, <code>Path</code>, <code>OnDeleteAction</code>), toggling (<code>Enable</code>/<code>Disable</code>), events (<code>Event</code>, carrying a deep-copied descriptor), and the crucial sentinel <code>Skip</code>.</p>
      <p><code>Skip</code> exists because <b>batching never removes commands from the queue</b> &mdash; removal would invalidate the per-entity chain indices. Consumed commands are rewritten in place to <code>Skip</code>, and the flush loop steps over them while still freeing their payloads.</p>` },
    { title: 'Per-Entity Chains &amp; the Sign Trick', diagram: `
<svg viewBox="0 0 880 280" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="m-cq" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cc99cc"/></marker></defs>
  <text x="30" y="34" fill="#b9a17c" font-size="12" class="svg-label">queue (insertion order preserved)</text>
  <rect x="30" y="50" width="130" height="60" rx="6" fill="#241c10" stroke="#ff9c00"/>
  <text x="95" y="74" text-anchor="middle" fill="#ffcc66" font-size="11.5" class="svg-mono">add(e1, Pos)</text>
  <text x="95" y="94" text-anchor="middle" fill="#cc99cc" font-size="10.5" class="svg-mono">next: -2</text>
  <rect x="170" y="50" width="130" height="60" rx="6" fill="#11111c" stroke="#99ccff"/>
  <text x="235" y="74" text-anchor="middle" fill="#99ccff" font-size="11.5" class="svg-mono">set(e2, Vel)</text>
  <text x="235" y="94" text-anchor="middle" fill="#8b8b9e" font-size="10.5" class="svg-mono">next: 0</text>
  <rect x="310" y="50" width="130" height="60" rx="6" fill="#241c10" stroke="#ff9c00"/>
  <text x="375" y="74" text-anchor="middle" fill="#ffcc66" font-size="11.5" class="svg-mono">add(e1, Vel)</text>
  <text x="375" y="94" text-anchor="middle" fill="#cc99cc" font-size="10.5" class="svg-mono">next: 3</text>
  <rect x="450" y="50" width="130" height="60" rx="6" fill="#241c10" stroke="#ff9c00"/>
  <text x="515" y="74" text-anchor="middle" fill="#ffcc66" font-size="11.5" class="svg-mono">set(e1, Mass)</text>
  <text x="515" y="94" text-anchor="middle" fill="#8b8b9e" font-size="10.5" class="svg-mono">next: 0</text>
  <rect x="590" y="50" width="130" height="60" rx="6" fill="#11111c" stroke="#5c5c6e"/>
  <text x="655" y="84" text-anchor="middle" fill="#8b8b9e" font-size="11.5" class="svg-mono">...</text>
  <path d="M 95 110 Q 95 160 370 160 Q 375 160 375 114" stroke="#cc99cc" fill="none" marker-end="url(#m-cq)"/>
  <path d="M 375 110 Q 375 175 510 175 Q 515 175 515 114" stroke="#cc99cc" fill="none" marker-end="url(#m-cq)"/>
  <text x="300" y="196" fill="#b9a17c" font-size="11.5" class="svg-label">e1’s chain, threaded through next_for_entity</text>
  <rect x="30" y="216" width="820" height="48" rx="10" fill="#0a0a10" stroke="#2a2a3a"/>
  <text x="50" y="238" fill="#e8d9bd" font-size="12" class="svg-label">sign trick: a <tspan fill="#ffcc66">negative</tspan> next_for_entity marks the chain head — the flush loop finds batchable entities</text>
  <text x="50" y="256" fill="#e8d9bd" font-size="12" class="svg-label">with a single sign test during its linear scan, zero extra memory. Single-command entities are never batched.</text>
</svg>`,
      caption: 'The queue is simultaneously a flat log and a set of per-entity linked lists. The entries sparse set tracks each entity’s first and last command.' },
    { title: 'The Batch: N Commands, One Table Move', html: `
      <p>Without batching, <code>add A; add B; set C</code> on one entity would be three archetype moves &mdash; each with its own column copying and hook dispatch. The batcher folds an entity’s whole chain into one commit, in three strictly ordered passes:</p>
      <ul>
        <li><b>Pass 1 &mdash; destination.</b> Walk the chain, folding each structural command into a running table-diff via the [[table-graph]]. Adds and removes cancel; a Clear resets to the root table; a Delete truncates the chain. Each folded command becomes <code>Skip</code>. Pair validity is checked here: if a pair target died, the command is dropped or &mdash; per the OnDeleteTarget policy &mdash; the whole entity is deleted instead.</li>
        <li><b>Pass 2 &mdash; values.</b> After a single <code>flecs_commit</code> moves the entity, surviving <code>Set</code>/<code>Ensure</code> payloads are moved from the command stack into the real columns. A set whose component was also removed in the same chain finds no destination and is dropped.</li>
        <li><b>Pass 3 &mdash; events.</b> OnAdd (and then OnSet) fire only now, <i>after</i> values are written &mdash; deliberately lifted out of the commit so an observer matching both an OnAdd and an OnSet term never sees an uninitialized value.</li>
      </ul>
      <p>Commands for entities that died mid-queue are discarded &mdash; but carefully: discarding still runs component destructors on the queued values, so deferred C++ objects don’t leak.</p>` },
    { title: 'Why Double-Buffered', html: `
      <p>Flushing runs observers; observers enqueue commands. Those new commands land in the stage’s <i>other</i> buffer while the first is being iterated (appending to the live one would invalidate the iteration on realloc). The flush loop alternates buffers until one comes back empty &mdash; a fixpoint iteration. The same "consume one, fill the other" idea appears wherever flecs drains a queue that can grow during draining.</p>` },
  ],
  related: ['stage', 'table-graph', 'world', 'observable', 'allocators'],
});
