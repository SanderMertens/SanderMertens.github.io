window.FLECS_TOUR.register([
  {
    id: "int-datastructures",
    parent: "internals",
    order: 1,
    title: "The Data Structure Toolbox",
    code: "INT-01",
    tagline: "Flecs brings its own containers instead of borrowing them",
    intro: "Flecs is written in plain C, which ships with almost no containers — no growable lists, no lookup tables. So Flecs builds its own small toolbox in <code>src/datastructures/</code>: a vector, a sparse set, two kinds of maps, a string builder, a bitset, and a family of allocators. Everything else in Flecs is built out of these few parts.",
    sections: [
      {
        type: "text",
        heading: "Why roll your own?",
        html: "<p>Think of a restaurant kitchen that makes its own stock instead of buying it in cans: it costs effort up front, but every dish that uses it gets better. Flecs makes the same trade with its containers:</p><ul><li><strong>Allocator-awareness.</strong> Almost every container takes an <em>allocator</em> — an object that hands out memory. Instead of asking the operating system for every little piece (slow, and scattered all over), containers ask a Flecs allocator that recycles memory it already owns. The world has one, and each stage (thread context) has its own, so threads never fight over the same pile.</li><li><strong>Exact fit.</strong> Each structure does exactly what the storage engine, queries, and command queue need — nothing more. The vector is three machine words. The sparse set is shaped around how entity ids work.</li><li><strong>No dependencies.</strong> The whole library stays a single <code>flecs.c</code> you can drop anywhere, from a game console to a microcontroller.</li></ul>"
      },
      {
        type: "diagram",
        heading: "Who uses what",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "d1", label: "ecs_vec_t", sub: "growable array" },
              { id: "d2", label: "ecs_sparse_t", sub: "stable id lookup" },
              { id: "d3", label: "ecs_map_t / hashmap", sub: "key-value lookup" },
              { id: "d4", label: "allocators", sub: "recycled memory" } ],
            [ { id: "u1", label: "Tables", sub: "component columns" },
              { id: "u2", label: "Entity index", sub: "where is entity e?" },
              { id: "u3", label: "Name lookup", sub: "find entity by name" },
              { id: "u4", label: "Command queue", sub: "deferred ops" } ]
          ],
          edges: [
            { from: "d1", to: "u1" },
            { from: "d2", to: "u2" },
            { from: "d3", to: "u3" },
            { from: "d4", to: "u4" }
          ],
          note: "A sample of pairings — in reality every subsystem uses several of these at once."
        }
      },
      {
        type: "text",
        heading: "The tour of the toolbox",
        html: "<p>The child pages walk through the toolbox one drawer at a time:</p><ul><li><strong>Vectors &amp; allocators</strong> — the growable array every column is made of, and the block and stack allocators that feed it.</li><li><strong>Sparse sets</strong> — the trick that turns a huge 64-bit id into an array index in two hops, with pointers that never move.</li><li><strong>Maps &amp; hashmaps</strong> — the two lookup tables, and when Flecs reaches for each.</li><li><strong>String buffer &amp; bitset</strong> — building JSON without a thousand allocations, and storing one bit per entity.</li></ul>"
      }
    ],
    related: ["storage", "int-command-queue", "world"]
  },
  {
    id: "int-vec-allocators",
    parent: "int-datastructures",
    order: 1,
    title: "Vectors & Allocators",
    code: "INT-01A",
    tagline: "A list that grows, fed by memory that gets recycled",
    intro: "The <code>ecs_vec_t</code> is a list that grows as you append to it — the workhorse behind every component column in every table. Behind it sit three allocators: a <em>block allocator</em> that recycles fixed-size chunks, a <em>stack allocator</em> for short-lived scratch memory, and a general <em>allocator</em> that picks the right block allocator for any size.",
    sections: [
      {
        type: "struct",
        heading: "The vector",
        name: "ecs_vec_t",
        summary: "Three fields, defined in include/flecs/datastructures/vec.h. The header calls it 'a component column' — that is its day job.",
        members: [
          { name: "array", type: "void*", desc: "Pointer to the elements, packed back to back in one block of memory. This is what makes iterating a table column fast: the data is one straight line." },
          { name: "count", type: "int32_t", desc: "How many elements are actually in use." },
          { name: "size", type: "int32_t", desc: "How many elements fit before the vector must grow. When count would pass size, the vector asks its allocator for a bigger block and copies everything over." },
          { name: "...sanitize", type: "debug only", desc: "In sanitized builds the vector also remembers its element size and type name, so it can catch you using a Position vector as if it held Velocities." }
        ]
      },
      {
        type: "text",
        heading: "The block allocator: an egg carton for memory",
        html: "<p>Flecs constantly creates and destroys small objects of the same size: commands, table records, map entries. Asking the operating system for each one is like driving to the store for every single egg. The <em>block allocator</em> (<code>ecs_block_allocator_t</code>) buys in bulk instead:</p><ul><li>It grabs one big block of memory (sized to fit as many chunks as possible in about 4KB) and slices it into equal chunks — an egg carton.</li><li>Free chunks are chained into a list. Allocating (<code>flecs_balloc</code>) pops the first free chunk; freeing (<code>flecs_bfree</code>) pushes it back. Both are just a pointer swap — nearly free.</li><li>When the carton is empty it buys another one and chains it on.</li></ul><p>On top of this, the general <code>ecs_allocator_t</code> keeps a small sparse set of block allocators, one per allocation size, and <code>flecs_allocator_get</code> hands out the right one. That is the allocator you see passed into vectors, maps and sparse sets. Defining <code>FLECS_USE_OS_ALLOC</code> compiles all of this away and falls straight through to plain malloc — handy when running memory debuggers.</p>"
      },
      {
        type: "text",
        heading: "The stack allocator: scratch paper",
        html: "<p>Some memory only needs to live for the length of one operation — the temporary state of an iterator, or the component value a deferred <code>ecs_set</code> is holding onto until the merge. For that, each stage carries a <em>stack allocator</em> (<code>ecs_stack_t</code>): pages of about a kilobyte where allocating just moves a pointer forward, like writing down a page on scratch paper.</p><ul><li>Before an operation starts, you take a <em>cursor</em> (<code>flecs_stack_get_cursor</code>) — a bookmark of where the pen is.</li><li>Allocations bump the pointer; when a page fills up, the stack chains on the next page.</li><li>When the operation ends, restoring the cursor (<code>flecs_stack_restore_cursor</code>) hands back everything allocated after it in one motion. No per-object bookkeeping at all.</li></ul><p>This is why creating and destroying query iterators every frame costs almost nothing: their memory comes from the stage's <code>iter_stack</code> and is reclaimed by rewinding a pointer.</p>"
      },
      {
        type: "diagram",
        heading: "Three allocators, three lifetimes",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "a1", label: "Block allocator", sub: "fixed-size chunks" },
              { id: "a2", label: "Stack allocator", sub: "bump pointer + cursor" },
              { id: "a3", label: "ecs_allocator_t", sub: "one ballocator per size" } ],
            [ { id: "b1", label: "Long-lived objects", sub: "records, map entries" },
              { id: "b2", label: "Scratch memory", sub: "iterators, deferred values" },
              { id: "b3", label: "Vectors & maps", sub: "any-size growth" } ]
          ],
          edges: [
            { from: "a1", to: "b1" },
            { from: "a2", to: "b2" },
            { from: "a3", to: "b3" }
          ],
          note: "Freed memory goes back to the allocator, not to the operating system — ready to be handed out again."
        }
      }
    ],
    related: ["int-sparse-sets", "int-command-queue", "storage"]
  },
  {
    id: "int-sparse-sets",
    parent: "int-datastructures",
    order: 2,
    title: "Sparse Sets",
    code: "INT-01B",
    tagline: "Turn any 64-bit id into an array slot in two hops",
    intro: "A sparse set answers the question &quot;give me the data for id 1004&quot; instantly, even though ids can be huge, sparse numbers with gaps everywhere. Flecs uses it wherever something must be found by id and must <em>never move in memory</em> — most famously the entity index, which uses the exact same trick to find any entity's table and row.",
    sections: [
      {
        type: "text",
        heading: "The hotel with numbered floors",
        html: "<p>Imagine a hotel where your room key is a big number like 1004. You don't search the whole building: the first digits tell you the <strong>floor</strong>, the last digits the <strong>door</strong>. Two hops, no searching.</p><p>The sparse set (<code>ecs_sparse_t</code>) does exactly this. An id is split in two: the high bits pick a <strong>page</strong> (id shifted right by 6, so pages hold 64 entries by default), the low bits pick a <strong>slot</strong> in that page. Each page owns two parallel arrays: a <code>sparse</code> array of indices, and a <code>data</code> array holding your actual elements.</p><p>Because elements live inside their page and pages are allocated once and never moved, a pointer into a sparse set stays valid forever — while a plain vector would move everything every time it grows. That stability is the whole point: the world can hand out pointers to records that survive any number of later insertions.</p>"
      },
      {
        type: "diagram",
        heading: "The two-hop lookup",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "s0", label: "id 1004", sub: "one 64-bit number" } ],
            [ { id: "s1", label: "Page 15", sub: "1004 >> 6" },
              { id: "s2", label: "Slot 44", sub: "1004 & 63" } ],
            [ { id: "s3", label: "page->sparse[44]", sub: "= 2, index into dense" },
              { id: "s4", label: "page->data[44]", sub: "your element, stable address" } ],
            [ { id: "s5", label: "dense[2]", sub: "= 1004, points back" } ]
          ],
          edges: [
            { from: "s0", to: "s1", label: "high bits" },
            { from: "s0", to: "s2", label: "low bits" },
            { from: "s2", to: "s3" },
            { from: "s2", to: "s4" },
            { from: "s3", to: "s5" },
            { from: "s5", to: "s3", dashed: true }
          ],
          note: "sparse and dense point at each other. If dense[sparse[id]] == id, the id is alive — that mutual handshake is the liveness check."
        }
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_sparse_t",
        summary: "From include/flecs/datastructures/sparse.h. Two vectors and some bookkeeping.",
        members: [
          { name: "dense", type: "ecs_vec_t", desc: "The dense array: a packed list of every id in the set, alive ones first. Iterating the set means walking this array — no gaps, no page hopping." },
          { name: "pages", type: "ecs_vec_t", desc: "The pages, each holding a sparse index array plus the data slots. Grows as bigger ids show up; existing pages never move." },
          { name: "size", type: "ecs_size_t", desc: "Size in bytes of one stored element." },
          { name: "count", type: "int32_t", desc: "How many entries at the front of dense are alive. Dead ids stay behind this line, waiting to be recycled." },
          { name: "max_id", type: "uint64_t", desc: "The highest id handed out so far, used when the set generates new ids itself." },
          { name: "allocator", type: "ecs_allocator_t*", desc: "Allocator for the vectors." },
          { name: "page_allocator", type: "ecs_block_allocator_t*", desc: "Block allocator for pages — they're all the same size, a perfect fit for the egg carton." }
        ]
      },
      {
        type: "text",
        heading: "Recycling, and the entity index connection",
        html: "<p>Removing an id doesn't delete anything: the id is swapped behind the alive <code>count</code> line in the dense array. The next time the set needs a fresh id, it first looks just past that line and reuses a dead one — its page slot is already allocated. This is the same recycling idea entity ids themselves use.</p><p>The <strong>entity index</strong> (<code>ecs_entity_index_t</code> in <code>src/storage/entity_index.h</code>) is a hand-specialized copy of this design: same dense array, same pages (1024 records each there), with each slot holding an <code>ecs_record_t</code> — the pointer to the entity's table and its row in it. Every single API call that touches an entity starts with this two-hop lookup. It also stores the world's per-table sparse storage for components marked as sparse.</p>"
      }
    ],
    related: ["int-vec-allocators", "storage", "world"]
  },
  {
    id: "int-maps",
    parent: "int-datastructures",
    order: 3,
    title: "Maps & Hashmaps",
    code: "INT-01C",
    tagline: "Two lookup tables: one for numbers, one for everything else",
    intro: "When the key isn't a nicely-behaved id, Flecs reaches for a lookup table. It has two: <code>ecs_map_t</code>, a lean table where both key and value are single 64-bit numbers, and <code>ecs_hashmap_t</code>, built on top of it, which can key on anything you can hash — like entity names.",
    sections: [
      {
        type: "text",
        heading: "The coat check",
        html: "<p>A map works like a coat check with many racks. Your key is run through a <em>hash</em> — a blender that turns it into a rack number — and your item is hung on that rack. To find it again: same key, same blender, same rack. Only the few coats on one rack ever need to be checked.</p><p><code>ecs_map_t</code> keeps this as simple as possible: keys and values are both plain 64-bit numbers (<code>ecs_map_data_t</code>), the racks are an array of <em>buckets</em>, and each bucket is a chain of entries allocated from the map's allocator. Because keys are already numbers, the &quot;blender&quot; is trivial, and the whole thing stays tiny.</p>"
      },
      {
        type: "struct",
        heading: "The simple one",
        name: "ecs_map_t",
        summary: "From include/flecs/datastructures/map.h. 64-bit keys to 64-bit values.",
        members: [
          { name: "buckets", type: "ecs_bucket_t*", desc: "The array of racks. Each bucket points at the first entry of a chain of key-value pairs that hashed to it." },
          { name: "bucket_count", type: "int32_t", desc: "How many buckets there are. Always a power of two, so picking a bucket is a bit-shift instead of a division." },
          { name: "count", type: "unsigned:26", desc: "Number of entries stored. When entries outnumber buckets, the map grows and rehashes." },
          { name: "bucket_shift", type: "unsigned:6", desc: "The shift that turns a hashed key into a bucket index — the power-of-two trick in person." },
          { name: "allocator", type: "ecs_allocator_t*", desc: "Where bucket entries come from." },
          { name: "...debug", type: "debug only", desc: "A change counter so debug builds can catch you modifying a map while iterating it." }
        ]
      },
      {
        type: "text",
        heading: "The flexible one",
        html: "<p><code>ecs_hashmap_t</code> handles keys that aren't numbers — a name string, a full table type. You give it two functions: a <em>hash</em> (turn a key into a 64-bit number) and a <em>compare</em> (are these two keys really equal?). Underneath, it's an <code>ecs_map_t</code> from hash to bucket, where each bucket holds two parallel vectors of full keys and values. The compare function settles ties when two different keys land on the same hash.</p><p>The <strong>name index</strong> (<code>src/datastructures/name_index.c</code>) is the busiest customer: a hashmap from <code>ecs_hashed_string_t</code> (a string plus its precomputed hash and length) to entity id. Every parent entity gets one, which is how <code>ecs_lookup(world, &quot;Sun.Earth&quot;)</code> resolves each step of a path without scanning children.</p>"
      },
      {
        type: "diagram",
        heading: "Where each one works",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "m1", label: "ecs_map_t", sub: "u64 key, u64 value" },
              { id: "m2", label: "ecs_hashmap_t", sub: "hash + compare callbacks" } ],
            [ { id: "w1", label: "id_index_hi", sub: "component id to record" },
              { id: "w2", label: "type_info", sub: "type id to size/hooks" },
              { id: "w3", label: "table_map", sub: "component list to table" },
              { id: "w4", label: "name index", sub: "name to entity, per parent" } ]
          ],
          edges: [
            { from: "m1", to: "w1" },
            { from: "m1", to: "w2" },
            { from: "m2", to: "w3" },
            { from: "m2", to: "w4" }
          ],
          note: "Rule of thumb in the source: key fits in a u64? ecs_map_t. Anything richer? ecs_hashmap_t."
        }
      }
    ],
    related: ["int-sparse-sets", "world", "storage"]
  },
  {
    id: "int-strbuf-bitset",
    parent: "int-datastructures",
    order: 4,
    title: "String Buffer & Bitset",
    code: "INT-01D",
    tagline: "Building big strings cheaply, and storing yes/no by the thousand",
    intro: "Two small but hard-working tools round out the toolbox: <code>ecs_strbuf_t</code>, which builds strings piece by piece without re-copying them every time, and <code>ecs_bitset_t</code>, which stores one yes/no bit per entity — the machinery behind component toggling.",
    sections: [
      {
        type: "text",
        heading: "The string buffer",
        html: "<p>Building a JSON snapshot of a world means gluing together thousands of little pieces of text. Doing that with plain string functions would copy the whole string every time you append — like rewriting a letter from the top each time you add a sentence.</p><p><code>ecs_strbuf_t</code> appends into a growing buffer instead, and starts with a 512-byte scratch area <em>inside the struct itself</em> — so short strings (most of them) never touch the heap at all. Only when you outgrow it does it allocate. When you're done, <code>ecs_strbuf_get</code> hands you the finished string.</p><p>Its party trick is the <em>list stack</em>: up to 32 levels of nested lists, each remembering its separator and element count. The JSON serializer leans on this — <code>appendlist</code>/<code>list_next</code> insert commas and brackets in the right places automatically, no matter how deep entities, components and values nest. Query plan printing and expression stringification use the same buffer.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_strbuf_t",
        summary: "From include/flecs/datastructures/strbuf.h.",
        members: [
          { name: "content", type: "char*", desc: "Points at the string being built — initially the small_string below, later a heap buffer if it outgrows it." },
          { name: "length", type: "ecs_size_t", desc: "How many bytes written so far." },
          { name: "size", type: "ecs_size_t", desc: "Capacity of the current buffer; appending past it triggers a grow-and-copy, doubling as needed." },
          { name: "list_stack", type: "ecs_strbuf_list_elem[32]", desc: "One entry per open nested list: its separator string and how many elements it has, so the buffer knows when to write a comma." },
          { name: "list_sp", type: "int32_t", desc: "Current nesting depth in the list stack." },
          { name: "small_string", type: "char[512]", desc: "The built-in scratch area. Strings that stay under 512 bytes cost zero allocations." }
        ]
      },
      {
        type: "text",
        heading: "The bitset",
        html: "<p><code>ecs_bitset_t</code> packs yes/no answers 64 to a machine word: bit number <em>n</em> lives in word <em>n / 64</em>. Storing whether ten thousand entities have something enabled takes about 1.2KB.</p><p>Its starring role is <strong>component toggling</strong>: when a component has the <code>CanToggle</code> trait, each table stores one bitset per toggleable component (the <code>bs_columns</code> in <code>src/storage/table.h</code>), one bit per row. <code>ecs_enable_id</code> flips the bit; the component's data stays exactly where it is. When a query iterates the table, it skips runs of entities whose bit is off — checking 64 entities per word — which is why toggling is dramatically cheaper than removing and re-adding the component (no table move, no memory copied).</p>"
      }
    ],
    related: ["remote", "queries", "components"]
  },
  {
    id: "int-command-queue",
    parent: "internals",
    order: 2,
    title: "The Command Queue",
    code: "INT-02",
    tagline: "A to-do list the world writes for itself",
    intro: "You can't rearrange the seats of a bus while it's driving. In the same way, Flecs can't move entities between tables while a query is walking those tables. So during iteration (and from worker threads), every add, remove, set and delete is not performed — it's <em>recorded</em> as a command, and the whole to-do list is executed in one go when it's safe. This page is about how that list actually works, in <code>src/commands.c</code>.",
    sections: [
      {
        type: "text",
        heading: "Recording",
        html: "<p>Each stage (thread context) owns a command queue: a vector of <code>ecs_cmd_t</code> entries, a stack allocator holding temporary component values, and a sparse set for per-entity bookkeeping. When deferred mode is on and you call <code>ecs_add</code>, Flecs appends one command and returns immediately — your call is a sticky note, not an action.</p><p>Values need special care: when you <code>ecs_set</code> while deferred, the component value is copied into the queue's stack allocator (using the component's copy hook if it has one), so it survives until the merge even if your local variable is gone. Actually there's a nicer trick: <code>ecs_ensure</code> while deferred hands you a pointer into that scratch space, so you can write the value directly with no extra copy.</p><p>Each stage carries <em>two</em> command queues (<code>cmd_stack[2]</code> in <code>src/stage.h</code>): while one is being executed, new commands triggered by that execution — an observer reacting to an add, for instance — are recorded into the other. The merge loops until both are empty.</p>"
      },
      {
        type: "struct",
        heading: "One command",
        name: "ecs_cmd_t",
        summary: "From src/commands.h. One recorded operation.",
        members: [
          { name: "kind", type: "ecs_cmd_kind_t", desc: "Which operation this is: EcsCmdAdd, EcsCmdRemove, EcsCmdSet, EcsCmdDelete, EcsCmdClear, EcsCmdEvent and friends. EcsCmdSkip marks a command that was cancelled out — see batching below." },
          { name: "next_for_entity", type: "int32_t", desc: "Index of the next command in the queue that targets the same entity — a linked list threaded through the queue. Negative on the first command of an entity's chain, as a marker." },
          { name: "id", type: "ecs_id_t", desc: "The component or pair the operation applies to." },
          { name: "entry", type: "ecs_cmd_entry_t*", desc: "Per-entity bookkeeping in the sparse set: the first and last command index for this entity. A last of -1 means this entity was deleted, so everything else for it can be ignored." },
          { name: "entity", type: "ecs_entity_t", desc: "The entity the operation targets." },
          { name: "is._1", type: "ecs_cmd_1_t", desc: "Payload for single-entity operations: a pointer to the stashed component value and its size." },
          { name: "is._n", type: "ecs_cmd_n_t", desc: "Payload for bulk operations: an array of entity ids and a count." },
          { name: "system", type: "ecs_entity_t", desc: "Which system enqueued this, so errors during the merge can name the culprit." }
        ]
      },
      {
        type: "diagram",
        heading: "The round trip",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "c1", label: "Your code", sub: "ecs_add / ecs_set / ecs_delete" } ],
            [ { id: "c2", label: "Command queue", sub: "vec of ecs_cmd_t" },
              { id: "c3", label: "Stack allocator", sub: "stashed values" },
              { id: "c4", label: "Entries sparse set", sub: "per-entity chains" } ],
            [ { id: "c5", label: "defer_end merge", sub: "batch per entity" } ],
            [ { id: "c6", label: "Tables", sub: "one move per entity" },
              { id: "c7", label: "Observers", sub: "events fire here" } ]
          ],
          edges: [
            { from: "c1", to: "c2", label: "record" },
            { from: "c1", to: "c3", dashed: true, label: "value copy" },
            { from: "c2", to: "c4", dashed: true },
            { from: "c2", to: "c5", label: "when safe" },
            { from: "c5", to: "c6" },
            { from: "c5", to: "c7" }
          ],
          note: "Deferred mode turns on automatically during ecs_progress and when using worker threads; you can also open it yourself with ecs_defer_begin."
        }
      },
      {
        type: "text",
        heading: "When does it flush?",
        html: "<p>The queue executes at <code>defer_end</code> — when the outermost <code>ecs_defer_end</code> closes, or at the sync points the pipeline places between systems. Commands replay in order, with one big exception: commands for the same entity are <em>batched</em> so the entity moves tables once instead of once per command. That optimization has its own page.</p>"
      }
    ],
    related: ["int-cmd-batching", "lifecycle", "systems", "int-vec-allocators"]
  },
  {
    id: "int-cmd-batching",
    parent: "int-command-queue",
    order: 1,
    title: "Batching & Merging",
    code: "INT-02A",
    tagline: "Ten sticky notes about one entity become a single move",
    intro: "If a frame adds five components to a freshly spawned entity, replaying those commands naively would move the entity through five different tables — five copies of everything it owns. The merge in <code>src/commands.c</code> avoids this by gathering all commands for one entity, combining them into a single table change, and cancelling out commands that contradict each other.",
    sections: [
      {
        type: "text",
        heading: "The chain",
        html: "<p>As commands are recorded, the queue keeps a per-entity chain: a sparse set entry remembers the <em>first</em> and <em>last</em> command index for each entity, and every command's <code>next_for_entity</code> points to that entity's next command. It's like leaving a trail of sticky notes where each one says where the next one is.</p><p>At merge time, <code>flecs_cmd_batch_for_entity</code> walks an entity's whole chain in one pass and builds a single <em>diff</em>: the net set of components to add and remove. Then the entity moves tables exactly once, all the add/remove events fire against that one move, and set commands write their stashed values into the final location.</p>"
      },
      {
        type: "text",
        heading: "Cancelling out",
        html: "<p>While walking the chain, the merge collapses commands that make each other pointless, stamping them <code>EcsCmdSkip</code>:</p><ul><li><strong>Add then remove</strong> of the same component within one batch: both disappear — the world never needs to know.</li><li><strong>Two sets</strong> of the same component: work is folded so the component lands with the final value.</li><li><strong>Anything after a delete:</strong> when a delete command is recorded, the entity's entry is marked (last set to -1). Every earlier or later command for that entity in the queue is skipped; only the delete runs. A dead entity needs no new coat of paint.</li><li><strong>Commands on entities that died some other way</strong> (say, cleaned up because their parent was deleted mid-merge) are skipped too, instead of crashing.</li></ul>"
      },
      {
        type: "diagram",
        heading: "One entity's chain, merged",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "b1", label: "cmd 0: add Position", sub: "next_for_entity: 2" },
              { id: "b2", label: "cmd 2: set Velocity", sub: "next_for_entity: 5" },
              { id: "b3", label: "cmd 5: remove Position", sub: "end of chain" } ],
            [ { id: "b4", label: "Batch diff", sub: "net: add Velocity" } ],
            [ { id: "b5", label: "One table move", sub: "[] to [Velocity]" } ]
          ],
          edges: [
            { from: "b1", to: "b4", dashed: true, label: "cancels with cmd 5" },
            { from: "b2", to: "b4" },
            { from: "b3", to: "b4", dashed: true },
            { from: "b4", to: "b5" }
          ],
          note: "Position was added and removed in the same batch, so it never existed as far as tables and observers are concerned."
        }
      },
      {
        type: "code",
        heading: "Seeing it from the outside",
        lang: "c",
        title: "All of this happens between defer_begin and defer_end",
        src: "ecs_defer_begin(world);\n\necs_entity_t e = ecs_new(world);\necs_add(world, e, Position);\necs_set(world, e, Velocity, {1, 2});\necs_remove(world, e, Position);\n\necs_defer_end(world);"
      }
    ],
    related: ["int-command-queue", "lifecycle", "events"]
  },
  {
    id: "int-poly",
    parent: "internals",
    order: 3,
    title: "The Poly Framework",
    code: "INT-03",
    tagline: "How one function can accept a world, a stage, or a query",
    intro: "Several Flecs functions take a mysterious <code>ecs_poly_t*</code> — a pointer that might be a world, a stage, a query, or an observer. The <em>poly</em> framework (<code>src/poly.c</code>) is the tiny type system that makes this safe in plain C: every such object starts with the same header that says what it is and what it can do.",
    sections: [
      {
        type: "text",
        heading: "The badge at the front door",
        html: "<p>C has no built-in way to ask a pointer &quot;what are you?&quot;. Poly objects solve this the way office buildings do: everyone wears a badge. Every poly object begins with an <code>ecs_header_t</code>, so no matter which object you're handed, the first bytes always contain its <em>magic number</em> — a 32-bit id naming its type.</p><p>The magic numbers are little easter eggs: they're ASCII. <code>0x65637377</code> spells <code>ecsw</code> (world), <code>0x65637373</code> is <code>ecss</code> (stage), <code>0x65637375</code> and <code>0x65637362</code> mark queries and observers. In debug builds, <code>flecs_poly_assert</code> checks the badge on every internal handoff, so passing a query where a world belongs fails loudly with the object's type name instead of corrupting memory.</p>"
      },
      {
        type: "struct",
        heading: "The header",
        name: "ecs_header_t",
        summary: "From include/flecs.h. The first member of ecs_world_t, ecs_stage_t, ecs_query_t and ecs_observer_t.",
        members: [
          { name: "type", type: "int32_t", desc: "The magic number saying which kind of object this is. Checked by debug asserts, switched on by functions that accept multiple types." },
          { name: "refcount", type: "int32_t", desc: "A reference count, so language bindings can build handles that keep the object alive as long as someone holds one." },
          { name: "mixins", type: "ecs_mixins_t*", desc: "Pointer to the type's mixin table — the menu of optional capabilities below. Shared by all objects of the same type." }
        ]
      },
      {
        type: "text",
        heading: "Mixins: the capability menu",
        html: "<p>Different poly types keep the same kinds of information at different offsets in their structs. A <em>mixin table</em> (<code>ecs_mixins_t</code>) is a per-type menu that says &quot;for this type, the world pointer lives at offset X, the destructor at offset Y&quot;. There are four mixin kinds: <strong>World</strong>, <strong>Entity</strong>, <strong>Observable</strong>, and <strong>Dtor</strong>.</p><p>This is what powers the everyday magic of passing a stage anywhere a world is expected: <code>ecs_get_world()</code> reads the header, follows the mixin table to the world member, and returns the real world — whether you handed it a world, a stage, a query or an observer. The Observable mixin does the same for event dispatch, and the Dtor mixin lets generic cleanup code destroy any poly object without knowing its type.</p><p>There's one more connection: queries and observers are also <em>entities</em>. Their poly object is attached to an entity via the <code>EcsPoly</code> component, as a pair like <code>(Poly, Query)</code>. That's the trick behind &quot;everything is an entity&quot; — you can name a query, put it in a hierarchy, or see it in the Explorer, because the object hangs off an entity like any other component.</p>"
      },
      {
        type: "diagram",
        heading: "One call, any object",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "p1", label: "ecs_get_world(poly)", sub: "poly could be anything" } ],
            [ { id: "p2", label: "ecs_header_t", sub: "magic + mixins" } ],
            [ { id: "p3", label: "Mixin table", sub: "offset of World member" } ],
            [ { id: "p4", label: "ecs_world_t*", sub: "the real world" } ]
          ],
          edges: [
            { from: "p1", to: "p2", label: "read header" },
            { from: "p2", to: "p3", label: "look up mixin" },
            { from: "p3", to: "p4", label: "follow offset" }
          ],
          note: "Tables opt out: they are internal-only and use an empty mixin table."
        }
      }
    ],
    related: ["world", "queries", "events", "lifecycle"]
  },
  {
    id: "int-os-api",
    parent: "internals",
    order: 4,
    title: "The OS API",
    code: "INT-04",
    tagline: "Every door to the outside world goes through one table of functions",
    intro: "Flecs never calls the operating system directly. Every allocation, thread, mutex, clock read and log line goes through <code>ecs_os_api_t</code> — one global table of function pointers defined in <code>include/flecs/os_api.h</code>. Swap the entries, and Flecs runs on your game engine's allocator, a console's threading library, or a bare-metal board.",
    sections: [
      {
        type: "text",
        heading: "The universal power adapter",
        html: "<p>Think of <code>ecs_os_api</code> as a travel adapter: Flecs always plugs into the same socket shape (<code>ecs_os_malloc</code>, <code>ecs_os_thread_new</code>, <code>ecs_os_now</code>...), and the adapter decides what's on the other side. Internally, every one of those calls is just a lookup in the global vtable — a struct full of function pointers.</p><p>Three layers fill the table:</p><ul><li><code>ecs_os_set_api_defaults()</code> installs what portable C can provide: malloc-family memory, timekeeping, and the built-in colorized logger. Threads and mutexes stay empty — plain C can't make those.</li><li>The <strong>os_api_impl addon</strong> (<code>src/addons/os_api_impl/</code>) fills the rest per platform: on POSIX it's pthreads for threads, mutexes and condition variables; on Windows it's <code>CreateThread</code>, <code>SRWLOCK</code>-style primitives, <code>CONDITION_VARIABLE</code> and <code>QueryPerformanceCounter</code> for high-resolution time.</li><li><strong>You</strong> can override any entry — set members and call <code>ecs_os_set_api()</code> before <code>ecs_init()</code>. Engines route <code>malloc_</code> into their own allocator; embedded targets stub out threads entirely (Flecs runs fine single-threaded).</li></ul>"
      },
      {
        type: "struct",
        heading: "The vtable, grouped",
        name: "ecs_os_api_t",
        summary: "The key groups of function pointers, from include/flecs/os_api.h. Trailing underscores mark them as slots you can assign.",
        members: [
          { name: "malloc_ / realloc_ / calloc_ / free_", type: "memory", desc: "All heap memory Flecs ever touches flows through these four, plus strdup_ for strings. Point them at your engine's allocator and every table, query and buffer follows." },
          { name: "thread_new_ / thread_join_ / thread_self_", type: "threads", desc: "Create and join worker threads for multithreaded pipelines. task_new_ and task_join_ are separate slots for engines that prefer a task/job system over raw threads." },
          { name: "ainc_ / adec_ / lainc_ / ladec_", type: "atomics", desc: "Atomic increment and decrement (32 and 64 bit) — the lock-free counters behind refcounts and stats." },
          { name: "mutex_* / cond_*", type: "locking", desc: "Mutexes plus condition variables (new, free, lock/unlock, signal, broadcast, wait) — how worker threads sleep until the pipeline hands them work." },
          { name: "sleep_ / now_ / get_time_", type: "time", desc: "Sleeping and two clocks: now_ is a cheap tick counter, get_time_ a high-resolution timestamp used for delta_time and stats." },
          { name: "log_", type: "logging", desc: "One function receives every log message with a level: positive is debug detail, 0 is trace, -2 warning, -3 error, -4 fatal. Replace it to pipe Flecs logs into your engine's console." },
          { name: "abort_", type: "termination", desc: "Called on fatal errors. Override to crash on your own terms (breakpoint, crash report) instead of calling abort()." },
          { name: "dlopen_ / dlproc_ / dlclose_ / module_to_dl_", type: "dynamic loading", desc: "Loading modules from shared libraries, and translating a module name like flecs.units into a filename." },
          { name: "perf_trace_push_ / perf_trace_pop_", type: "profiling", desc: "Hooks that bracket internal operations, so a profiler like Tracy can show Flecs spans inside your frame." },
          { name: "...state", type: "misc", desc: "fopen_/fclose_/fread_ for file access, log level and indentation state, flags, and the output FILE* for the default logger." }
        ]
      },
      {
        type: "diagram",
        heading: "The layers",
        spec: {
          type: "stack",
          layers: [
            { label: "Flecs core & addons", sub: "only ever call ecs_os_* wrappers" },
            { label: "ecs_os_api_t", sub: "one global table of function pointers" },
            { label: "os_api_impl addon", sub: "posix_impl.inl / windows_impl.inl" },
            { label: "Your overrides", sub: "engine allocator, job system, custom logger" }
          ],
          note: "Overrides win: whatever you install before ecs_init() is what every layer above uses."
        }
      },
      {
        type: "code",
        heading: "Overriding for your engine",
        lang: "c",
        title: "Route Flecs memory through your own allocator",
        src: "ecs_os_set_api_defaults();\n\necs_os_api_t api = ecs_os_get_api();\napi.malloc_ = my_engine_malloc;\napi.realloc_ = my_engine_realloc;\napi.calloc_ = my_engine_calloc;\napi.free_ = my_engine_free;\napi.log_ = my_engine_log;\necs_os_set_api(&api);\n\necs_world_t *world = ecs_init();"
      }
    ],
    related: ["world", "systems", "observability"]
  },
  {
    id: "int-parser",
    parent: "internals",
    order: 5,
    title: "The Shared Parser",
    code: "INT-05",
    tagline: "One tokenizer feeds both the query language and Flecs Script",
    intro: "The query string <code>&quot;Position, !Velocity&quot;</code> and a whole Flecs Script scene file are read by the same machinery: a shared <em>parser core</em> in <code>src/addons/parser/</code> that chops text into tokens, with two customers on top — the query DSL addon and Flecs Script.",
    sections: [
      {
        type: "text",
        heading: "First, chop the text into words",
        html: "<p>A <em>tokenizer</em> is the first stage of reading any language: it turns a stream of characters into a stream of labeled pieces, the way you'd read a sentence as words before worrying about grammar. <code>&quot;Position, !Velocity&quot;</code> becomes: identifier <code>Position</code>, comma, not-operator, identifier <code>Velocity</code>.</p><p>The shared tokenizer (<code>tokenizer.c</code>) knows every token either language will ever need: identifiers, numbers, strings, all the operators (<code>!</code>, <code>?</code>, <code>|</code>, <code>==</code>, <code>..</code>, <code>-&gt;</code>...), and keywords like <code>template</code>, <code>const</code>, <code>using</code> and <code>if</code>. Each token comes back as an <code>ecs_token_t</code>: the text plus a kind from the <code>ecs_token_kind_t</code> enum. The keywords only matter to Flecs Script — the query DSL simply never asks for them — which is exactly what makes sharing painless.</p><p>All parsing state travels in one struct, <code>ecs_parser_t</code>: the source name and text (for pinpointing errors with line and column), the current position, token scratch memory, and a slot for whichever customer is driving — a script being built, or a term being filled in.</p>"
      },
      {
        type: "diagram",
        heading: "Two customers, one core",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "t1", label: "\"Position, !Velocity\"", sub: "query string" },
              { id: "t2", label: "scene.flecs", sub: "script source" } ],
            [ { id: "t3", label: "Shared tokenizer", sub: "ecs_parser_t + ecs_token_t" } ],
            [ { id: "t4", label: "query_dsl addon", sub: "flecs_terms_parse" },
              { id: "t5", label: "script parser", sub: "builds an AST" } ],
            [ { id: "t6", label: "ecs_term_t array", sub: "into the query compiler" },
              { id: "t7", label: "Entities & components", sub: "via script evaluation" } ]
          ],
          edges: [
            { from: "t1", to: "t3" },
            { from: "t2", to: "t3" },
            { from: "t3", to: "t4" },
            { from: "t3", to: "t5" },
            { from: "t4", to: "t6" },
            { from: "t5", to: "t7" }
          ],
          note: "Script can also embed queries — its q keyword hands the text straight to the query DSL parser."
        }
      },
      {
        type: "text",
        heading: "The two customers",
        html: "<p><strong>The query DSL addon</strong> (<code>src/addons/query_dsl/</code>) is the smaller one. Its job: turn a query string into the same <code>ecs_term_t</code> array you could have written in C by hand. It walks tokens and fills in each term's source, first and second elements, operators like <code>!</code> and <code>?</code>, and traversal flags like <code>up</code> and <code>cascade</code>. From there the string is forgotten — the query compiler only ever sees terms, so string queries and C-built queries are exactly equal citizens.</p><p><strong>Flecs Script</strong> is the bigger one. Its parser (<code>src/addons/script/parser.c</code>) uses the same tokens to build an <em>AST</em> — a tree of statements like &quot;entity with these components, containing these children&quot; — which a separate visitor then evaluates against the world. That split is what enables templates and hot-reloading: the tree can be kept, re-run, and diffed without re-reading the text.</p><p>The layering means the parser addon itself is invisible plumbing: it's compiled in automatically whenever <code>FLECS_QUERY_DSL</code> or <code>FLECS_SCRIPT</code> is enabled, and has no public API of its own.</p>"
      },
      {
        type: "code",
        heading: "Both roads, side by side",
        lang: "c",
        title: "The string version compiles into exactly what the C version declares",
        src: "ecs_query_t *q1 = ecs_query(world, {\n  .expr = \"Position, !Velocity\"\n});\n\necs_query_t *q2 = ecs_query(world, {\n  .terms = {\n    { .id = ecs_id(Position) },\n    { .id = ecs_id(Velocity), .oper = EcsNot }\n  }\n});"
      }
    ],
    related: ["queries", "script", "int-strbuf-bitset"]
  }
]);
