window.FLECS_TOUR.register([
  {
    id: "sto-tables",
    parent: "storage",
    order: 1,
    title: "Tables & Archetypes",
    code: "STO-01",
    tagline: "Entities with the same components live together",
    intro: "A <em>table</em> (also called an <em>archetype</em>) stores all entities that have exactly the same set of components. The set itself — a sorted list of component ids — is called the table's <em>type</em>. Every unique combination of components in your world gets exactly one table, created automatically the first time an entity uses it.",
    sections: [
      {
        type: "text",
        heading: "The filing cabinet analogy",
        html: "<p>Picture an office with many filing cabinets. Each cabinet holds forms that all have the <strong>exact same fields</strong>: one cabinet for forms with a name and address, another for forms with a name, address and phone number. When a form gains a new field, it moves to the cabinet that matches its new shape.</p><p>Flecs stores entities the same way. An entity with Position and Velocity lives in the <code>[Position, Velocity]</code> table, next to every other entity with precisely those two components. Add Health to it and it moves to the <code>[Position, Velocity, Health]</code> table. You never create tables yourself — <code>flecs_table_find_or_create</code> makes one the first time a combination appears, and the new table is immediately matched against existing queries.</p>"
      },
      {
        type: "diagram",
        heading: "Two tables",
        spec: {
          type: "grid",
          title: "Table [Position, Velocity]",
          cols: ["Entity", "Position", "Velocity"],
          rows: [
            ["e1", "10, 20", "1, 0"],
            ["e2", "3, 5", "0, 2"],
            ["e3", "8, 8", "2, 2"]
          ],
          note: "Every entity in this table has Position and Velocity — nothing more, nothing less."
        }
      },
      {
        type: "diagram",
        heading: "A different combination, a different table",
        spec: {
          type: "grid",
          title: "Table [Position, Velocity, Health]",
          cols: ["Entity", "Position", "Velocity", "Health"],
          rows: [
            ["e9", "0, 0", "1, 1", "100"],
            ["e12", "40, 2", "0, 1", "75"]
          ],
          note: "Same components plus Health = a separate table with its own arrays."
        }
      },
      {
        type: "code",
        heading: "See it yourself",
        lang: "c",
        title: "Print the table an entity lives in",
        src: "ecs_entity_t e = ecs_new(world);\necs_set(world, e, Position, {10, 20});\necs_set(world, e, Velocity, {1, 0});\n\necs_table_t *table = ecs_get_table(world, e);\nchar *str = ecs_table_str(world, table);\nprintf(\"%s\\n\", str);\necs_os_free(str);"
      },
      {
        type: "text",
        heading: "Why this layout is fast — and what it costs",
        html: "<p>Inside a table, each component is one tight array (a <em>column</em>). Iterating all entities with Position and Velocity means walking two plain arrays from start to end — the fastest thing a CPU can do with memory, because the next value is always right next to the last one.</p><p>The price: an entity's components decide <em>where it lives</em>, so adding or removing a component means moving the entity to another table. The child pages dig into both sides of this trade: what a table looks like inside, and what a move actually does.</p>"
      }
    ],
    related: ["sto-table-anatomy", "sto-table-moves", "components", "queries"]
  },
  {
    id: "sto-table-anatomy",
    parent: "sto-tables",
    order: 1,
    title: "Inside a Table",
    code: "STO-01A",
    tagline: "One array of entity ids, one array per component",
    intro: "A table is a bundle of parallel arrays: one array with entity ids, and one <em>column</em> for every component that has data. Row 4 of the entity array and row 4 of every column together describe one entity. Tags — components without data — appear in the table's type but get no column at all.",
    sections: [
      {
        type: "diagram",
        heading: "Parallel arrays",
        spec: {
          type: "grid",
          title: "Table [Position, Velocity, Enemy] — row by row",
          cols: ["Row", "entities[]", "Position[]", "Velocity[]"],
          rows: [
            ["0", "e7", "10, 20", "1, 0"],
            ["1", "e12", "3, 5", "0, 2"],
            ["2", "e40", "8, 1", "2, 2"]
          ],
          note: "Enemy is a tag: it is part of the type, but stores no data, so there is no Enemy column."
        }
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_table_t",
        summary: "The table struct from src/storage/table.h, lightly grouped. It is the id, the type, the data, and a set of lookup helpers.",
        members: [
          { name: "id", type: "uint64_t", desc: "The table's id in the world's table store." },
          { name: "type", type: "ecs_type_t", desc: "The sorted array of component ids that defines this table. Two entities are in the same table exactly when their types are equal." },
          { name: "data", type: "ecs_data_t", desc: "The actual storage: the entities array, the columns array (each column is a data pointer plus type info), and the current count and allocated size." },
          { name: "node", type: "ecs_graph_node_t", desc: "This table's place in the table graph: cached add and remove edges to neighboring tables." },
          { name: "column_count", type: "int16_t", desc: "Number of columns with data. Smaller than the type count when the table contains tags." },
          { name: "component_map", type: "int16_t*", desc: "Fast lookup from a component id to its column, for low component ids." },
          { name: "column_map", type: "int16_t*", desc: "Translates both ways between a position in the type and a column index, since tags make the two run out of step." },
          { name: "dirty_state", type: "int32_t*", desc: "One change counter per column. Queries compare these counters to detect whether data changed since they last looked." },
          { name: "bloom_filter", type: "uint64_t", desc: "A 64-bit fingerprint of the type. Queries test it first to cheaply say \"this table definitely doesn't have what I need\"." },
          { name: "flags", type: "ecs_flags32_t", desc: "Cached properties of the table, like whether components have constructors or the table contains prefabs, so hot paths can branch on one integer." },
          { name: "_", type: "ecs_table__t*", desc: "Rarely used metadata kept out of the hot struct: the type hash, a modification lock, the list of table records, and bitset columns for toggleable components." },
          { name: "...internal", type: "", desc: "Version counter, refcount, cached trait flags, and the position of the ChildOf pair in the type." }
        ]
      },
      {
        type: "text",
        heading: "Removing a row: swap with last",
        html: "<p>When an entity leaves a table, Flecs does not slide every later row up one spot — that would touch the whole table. Instead <code>flecs_table_delete</code> moves the <strong>last</strong> row into the hole and shrinks the count by one, like filling an empty parking spot with the car from the end of the row.</p><p>The cost is one move per column, no matter how big the table is. The trade: row order inside a table is not stable. The entity that got moved also needs its bookkeeping fixed — its entry in the entity index is updated to point at its new row.</p>"
      },
      {
        type: "diagram",
        heading: "Before the delete",
        spec: {
          type: "grid",
          title: "Deleting e12 from row 1",
          cols: ["Row", "entities[]", "Position[]"],
          rows: [
            ["0", "e7", "10, 20"],
            ["1", "e12", "3, 5"],
            ["2", "e21", "6, 6"],
            ["3", "e40", "8, 1"]
          ]
        }
      },
      {
        type: "diagram",
        heading: "After the delete",
        spec: {
          type: "grid",
          title: "e40 was swapped into the hole",
          cols: ["Row", "entities[]", "Position[]"],
          rows: [
            ["0", "e7", "10, 20"],
            ["1", "e40", "8, 1"],
            ["2", "e21", "6, 6"]
          ],
          note: "Only e40 moved. The table never shifts more than one row, however large it is."
        }
      }
    ],
    related: ["sto-table-moves", "sto-entity-index", "internals"]
  },
  {
    id: "sto-table-moves",
    parent: "sto-tables",
    order: 2,
    title: "Archetype Moves",
    code: "STO-01B",
    tagline: "Adding a component means moving house",
    intro: "Because a table only holds entities with one exact component set, adding or removing a component forces the entity to move to a different table. Flecs copies the entity's row into the destination table, then swap-removes it from the source. This is the fundamental cost of the archetype design — and it is very predictable.",
    sections: [
      {
        type: "code",
        heading: "One line, one move",
        lang: "c",
        title: "This add moves e2 between tables",
        src: "ecs_entity_t e2 = ecs_new(world);\necs_set(world, e2, Position, {5, 5});\n\necs_add(world, e2, Velocity);"
      },
      {
        type: "diagram",
        heading: "Before the add",
        spec: {
          type: "grid",
          title: "e2 lives in [Position]",
          cols: ["Table", "Entity", "Position", "Velocity"],
          rows: [
            ["[Position]", "e1", "0, 0", ""],
            ["[Position]", "e2", "5, 5", ""],
            ["[Position]", "e3", "7, 1", ""],
            ["[Position, Velocity]", "e9", "2, 2", "1, 1"]
          ]
        }
      },
      {
        type: "diagram",
        heading: "After ecs_add(world, e2, Velocity)",
        spec: {
          type: "grid",
          title: "e2 moved, e3 filled its old row",
          cols: ["Table", "Entity", "Position", "Velocity"],
          rows: [
            ["[Position]", "e1", "0, 0", ""],
            ["[Position]", "e3", "7, 1", ""],
            ["[Position, Velocity]", "e9", "2, 2", "1, 1"],
            ["[Position, Velocity]", "e2", "5, 5", "0, 0"]
          ],
          note: "Position data was copied over; the new Velocity starts default-constructed."
        }
      },
      {
        type: "text",
        heading: "The cost model",
        html: "<p>What a move costs, piece by piece:</p><ul><li><strong>Proportional to the entity, not the table.</strong> <code>flecs_table_move</code> copies one row: each component the entity has gets moved once. A move costs the same in a table of 10 entities or 10 million.</li><li><strong>Hooks run.</strong> If components have constructors, destructors or move hooks, they are invoked during the move. Plain data moves with a fast memcpy path.</li><li><strong>The first time is the expensive time.</strong> The very first time a component combination appears, Flecs must create the table and match it against every existing query. Afterwards the destination is cached on a graph edge and the same add is little more than a pointer hop — see the table graph page.</li><li><strong>Bookkeeping.</strong> The entity index entry is updated, and the entity that got swap-moved in the source table gets its row fixed too.</li></ul><p>Practical advice that falls out of this: set up an entity's components together (or use prefabs and bulk operations) instead of adding components one by one in a hot loop, and avoid flip-flopping a component on and off every frame — toggle a value inside a component, or use a sparse component, instead.</p>"
      }
    ],
    related: ["sto-table-graph", "sto-sparse", "lifecycle"]
  },
  {
    id: "sto-table-graph",
    parent: "storage",
    order: 2,
    title: "The Table Graph",
    code: "STO-02",
    tagline: "A subway map connecting every table to its neighbors",
    intro: "Tables are connected in a graph: an <em>add edge</em> labeled Velocity leads from <code>[Position]</code> to <code>[Position, Velocity]</code>, and a <em>remove edge</em> leads back. Once an edge exists, following it is a single lookup — which is why the second time you add the same component, it is dramatically cheaper than the first.",
    sections: [
      {
        type: "text",
        heading: "Why a graph?",
        html: "<p>Think of tables as subway stations and component operations as lines between them. The first time you travel from <code>[Position]</code> by &quot;add Velocity&quot;, Flecs has to figure out where that leads: build the sorted destination type, look it up by hash in the table map, create the table if it does not exist yet, and match it against queries.</p><p>That work would be far too slow to repeat every time. So the answer is stored as an <strong>edge</strong> on the source table's graph node: &quot;from here, adding Velocity takes you there&quot;. Every later <code>ecs_add</code> of Velocity from that table follows the cached edge directly to the destination table. After this warmup, repeated add/remove between the same tables is cheap and constant-time.</p>"
      },
      {
        type: "diagram",
        heading: "Edges between tables",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "t0", label: "[Position]", sub: "table" } ],
            [ { id: "t1", label: "[Position, Velocity]", sub: "table" } ],
            [ { id: "t2", label: "[Position, Velocity, Health]", sub: "table" } ]
          ],
          edges: [
            { from: "t0", to: "t1", label: "add Velocity" },
            { from: "t1", to: "t0", label: "remove Velocity", dashed: true },
            { from: "t1", to: "t2", label: "add Health" }
          ],
          note: "Solid edges are cached add edges; the dashed edge is the cached remove edge back."
        }
      },
      {
        type: "text",
        heading: "What travels along an edge",
        html: "<p>An edge stores more than a destination. It carries a <em>diff</em>: the list of component ids that appear or disappear when crossing it. That diff is what tells the rest of Flecs which <code>OnAdd</code> and <code>OnRemove</code> events to emit and which constructors and destructors to run, without re-comparing the two types on every move.</p><p>Most edges add or remove exactly one id, but some are bigger: removing a component can also strip components that depended on it, and adding a pair can pull in components inherited through relationships. The diff captures all of it once, when the edge is first built.</p>"
      },
      {
        type: "text",
        heading: "Cost picture",
        html: "<ul><li><strong>Cold:</strong> first traversal pays for type construction, a hash lookup, possibly table creation and query matching. This is the expensive, once-per-combination event.</li><li><strong>Warm:</strong> traversal is one array index or one map lookup on the source table. This is what your steady-state frames pay.</li><li><strong>Memory:</strong> edges accumulate on busy tables. Flecs keeps the common case tiny with a two-tier layout, covered in the next page.</li></ul>"
      }
    ],
    related: ["sto-graph-edges", "sto-tables", "sto-table-moves"]
  },
  {
    id: "sto-graph-edges",
    parent: "sto-table-graph",
    order: 1,
    title: "Edges Up Close",
    code: "STO-02A",
    tagline: "A tiny array for common ids, a map for the rest",
    intro: "Each table's graph node keeps its outgoing add edges and remove edges in a two-tier structure: a flat lookup array for low component ids, and a map for everything else. Edges also link themselves into the destination table's incoming list, so they can be cleaned up when a table dies.",
    sections: [
      {
        type: "text",
        heading: "Low road and high road",
        html: "<p>Component ids below <code>FLECS_HI_COMPONENT_ID</code> (256 by default) are the ids handed out first — in practice, your most-used components. For those, the edge lives in a plain array (<code>lo</code>) indexed directly by the id: following it is a single array access, no hashing, no searching.</p><p>Everything else — high ids and relationship pairs — goes into a small map (<code>hi</code>) from id to edge. Still fast, just one map lookup instead of one array index. You can tune the constant at compile time to trade memory for speed.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_graph_edge_t",
        summary: "One cached edge in the table graph, from src/storage/table_graph.h.",
        members: [
          { name: "hdr", type: "ecs_graph_edge_hdr_t", desc: "Links this edge into the destination table's list of incoming edges. When a table is deleted, Flecs walks this list to remove every edge that pointed at it." },
          { name: "from", type: "ecs_table_t*", desc: "The table you are coming from." },
          { name: "to", type: "ecs_table_t*", desc: "The table this operation takes you to." },
          { name: "diff", type: "ecs_table_diff_t*", desc: "The precomputed lists of component ids added and removed when crossing this edge, plus flags describing them. Used to fire the right events and hooks without re-comparing types." },
          { name: "id", type: "ecs_id_t", desc: "The component id this edge is labeled with — the thing being added or removed." }
        ]
      },
      {
        type: "text",
        heading: "Why incoming edges matter",
        html: "<p>Tables are not forever: when a table has been empty for a while, Flecs can delete it to reclaim memory. But other tables still hold cached edges pointing at it. The incoming edge list makes this cleanup cheap: walk the list, unhook each edge, done. Without it, deleting one table would mean scanning every other table's edge storage.</p><p>The takeaway for your code: the graph maintains itself. Your only lever is warmup — the first frame that creates many new component combinations will be slower than the frames that reuse them.</p>"
      }
    ],
    related: ["sto-table-graph", "internals"]
  },
  {
    id: "sto-entity-index",
    parent: "storage",
    order: 3,
    title: "The Entity Index",
    code: "STO-03",
    tagline: "Ask \"where is entity 42?\" and get an instant answer",
    intro: "The entity index is the world's address book: for every entity id it stores an <code>ecs_record_t</code> that says which table the entity lives in and at which row. Every <code>ecs_get</code>, <code>ecs_add</code> and <code>ecs_delete</code> starts here, so the lookup is built to cost almost nothing: two array indexations, no searching.",
    sections: [
      {
        type: "text",
        heading: "The hotel register",
        html: "<p>Think of a hotel where every guest has a number. The front desk keeps a register: guest 402 is in building B, room 17. Nobody wanders the halls looking for a guest — you check the register and walk straight there.</p><p>Flecs keeps its register in <strong>pages</strong>: fixed-size blocks of 1024 records. The low bits of the entity id pick the record within a page, the bits above them pick the page. Records never move once created, so a pointer to a record stays valid — the record's <em>contents</em> (table, row) change as the entity moves around.</p>"
      },
      {
        type: "diagram",
        heading: "From id to component, in constant time",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "eid", label: "Entity id 402", sub: "from your code" } ],
            [ { id: "page", label: "Page 0", sub: "id >> 10 picks the page" } ],
            [ { id: "rec", label: "ecs_record_t", sub: "records[id & 1023]" } ],
            [ { id: "cell", label: "Table cell", sub: "table, row 7" } ]
          ],
          edges: [
            { from: "eid", to: "page" },
            { from: "page", to: "rec" },
            { from: "rec", to: "cell", label: "table + row" }
          ],
          note: "Two array lookups later you are standing at the entity's data."
        }
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_record_t",
        summary: "One entry in the entity index, from include/flecs/private/api_internals.h.",
        members: [
          { name: "table", type: "ecs_table_t*", desc: "The table the entity currently lives in. Updated every time the entity moves between tables." },
          { name: "row", type: "uint32_t", desc: "Two things packed into one number: the low 28 bits are the entity's row in the table, the top bits are flags such as \"this entity is used as a relationship target\". Use ECS_RECORD_TO_ROW to get the plain row." },
          { name: "dense", type: "int32_t", desc: "Index into the entity index's dense array, which is where liveness and generation are tracked. Zero means the entity does not exist." }
        ]
      },
      {
        type: "text",
        heading: "Generations: catching stale ids",
        html: "<p>When an entity is deleted, its id number gets recycled for a new entity — but with a bumped <em>generation</em>, a counter stored in the upper bits of the 64-bit id. The index keeps a <em>dense array</em> of full ids, with all alive entities packed at the front. A lookup is only valid if the record's dense slot is in the alive range <strong>and</strong> the id stored there matches yours, generation included.</p><p>So if you kept an id from three frames ago and the entity died in between, Flecs catches it: your stale id has the old generation, the register has the new one, and the lookup fails safely instead of handing you some stranger's data.</p><p><strong>Cost:</strong> creation, deletion and lookup are all constant-time. The index grows one 1024-record page at a time, only for id ranges you actually use.</p>"
      }
    ],
    related: ["sto-tables", "sto-table-anatomy", "world"]
  },
  {
    id: "sto-component-index",
    parent: "storage",
    order: 4,
    title: "The Component Index",
    code: "STO-04",
    tagline: "For every component: everything the world knows about it",
    intro: "The entity index answers &quot;where is this entity?&quot;. The component index answers the opposite question: &quot;which tables contain this component?&quot;. For every component id the world keeps one <code>ecs_component_record_t</code> holding the list of tables that contain it, its type info, its traits, and any special storage it uses.",
    sections: [
      {
        type: "text",
        heading: "The card catalog",
        html: "<p>An old library had a card catalog: one drawer per subject, and inside, a card for every shelf holding a book on that subject. You did not search the library — you searched the drawer.</p><p>The component record is that drawer. When a query looks for entities with Position, it does not scan all tables. It fetches Position's component record and reads its <em>table cache</em>: the complete, ready-made list of every table whose type contains Position — with a note per table saying which column the data sits in.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_component_record_t",
        summary: "Everything the world tracks per component id, from src/storage/component_index.h.",
        members: [
          { name: "cache", type: "ecs_table_cache_t", desc: "The star of the show: the cache of all tables that contain this id, each entry recording where in the table the id sits. Queries iterate this." },
          { name: "id", type: "ecs_id_t", desc: "The component id this record describes. Can be a plain component, a tag, or a relationship pair." },
          { name: "flags", type: "ecs_flags32_t", desc: "Cached traits of the id: sparse, don't-fragment, exclusive, and so on, so hot paths check one integer instead of querying traits." },
          { name: "type_info", type: "const ecs_type_info_t*", desc: "Size, alignment and lifecycle hooks of the component's data. NULL for tags, which carry no data." },
          { name: "sparse", type: "void*", desc: "The paged sparse set holding component data when this id uses sparse storage (the Sparse or DontFragment traits)." },
          { name: "dont_fragment_tables", type: "ecs_vec_t", desc: "Back-references used by non-fragmenting ids to find tables with edges that mention them." },
          { name: "pair", type: "ecs_pair_record_t*", desc: "Extra data for relationship pairs only: the child name lookup index, the ordered children vector, non-fragmenting children tables, hierarchy depth, and the linked lists that connect all (R, *) and (*, T) records for wildcard matching." },
          { name: "non_fragmenting", type: "ecs_id_record_elem_t", desc: "Links this record into the world-wide list of all non-fragmenting ids." },
          { name: "refcount", type: "int32_t", desc: "How many tables, queries and callers are using this record; it is freed when this reaches zero." }
        ]
      },
      {
        type: "diagram",
        heading: "How a query finds its tables",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "q", label: "Query", sub: "Position, Velocity" } ],
            [ { id: "cr", label: "Component record", sub: "for Position" } ],
            [ { id: "tc", label: "Table cache", sub: "all tables with Position" } ],
            [ { id: "m", label: "Matched tables", sub: "those that also have Velocity" } ]
          ],
          edges: [
            { from: "q", to: "cr", label: "first term" },
            { from: "cr", to: "tc" },
            { from: "tc", to: "m", label: "test other terms" }
          ],
          note: "Candidate tables come from one component's cache; the remaining terms are checked per table, not per entity."
        }
      },
      {
        type: "text",
        heading: "Why this is the key to query speed",
        html: "<p>Matching happens <strong>per table, not per entity</strong>. A table with 100,000 entities is accepted or rejected once. Whether a table has a component is answered by the table record in the cache, and the same record says which column to read — so by the time a query iterates, there is nothing left to look up per entity.</p><p>Cached queries take it further: they store their matched-table list up front and only revisit it when tables are created or deleted. The component index is what makes that maintenance cheap too — a new table registers itself with the record of every id in its type, which is exactly how queries learn it exists. The table cache child page shows the structure that keeps all this constant-time.</p>"
      }
    ],
    related: ["sto-table-cache", "queries", "sto-tables"]
  },
  {
    id: "sto-table-cache",
    parent: "sto-component-index",
    order: 1,
    title: "The Table Cache",
    code: "STO-04A",
    tagline: "A packed list you can also jump into instantly",
    intro: "The table cache is the data structure inside every component record that holds &quot;all tables with this id&quot;. It is built to be great at two things at once: iterating all entries in a tight loop (for queries), and finding or removing one specific table's entry in constant time (for storage maintenance).",
    sections: [
      {
        type: "text",
        heading: "Two structures, one cache",
        html: "<p>Imagine a class attendance list: names written densely on one sheet (fast to read top to bottom), plus an index card box telling you which line each student is on (fast to find one). The table cache is exactly that pair:</p><ul><li>A <strong>dense vector</strong> of table records, stored back to back so queries can sweep through them cache-friendly.</li><li>A <strong>map</strong> from table id to position in that vector, so inserting or removing a table is a constant-time operation — remove uses the same swap-with-last trick as tables themselves.</li></ul><p>The cache also keeps a <code>queryable_count</code> and stores queryable tables at the front, so queries can iterate just the part that matters to them.</p>"
      },
      {
        type: "struct",
        heading: "One entry in the cache",
        name: "ecs_table_record_t",
        summary: "The record stored per (component, table) combination, from include/flecs/private/api_internals.h. This is what tells a query where a component lives inside a specific table.",
        members: [
          { name: "hdr", type: "ecs_table_cache_hdr_t", desc: "The cache header: a pointer back to the component record and a pointer to the table this entry is about." },
          { name: "index", type: "int16_t", desc: "The first position in the table's type where this id occurs." },
          { name: "count", type: "int16_t", desc: "How many times the id occurs in the type. Usually 1, but a wildcard like (Likes, *) can match several pairs in one table." },
          { name: "column", type: "int16_t", desc: "The first data column where the id's component data lives, so iteration can go straight to the right array. Only meaningful when the id has data." }
        ]
      },
      {
        type: "text",
        heading: "Cost picture",
        html: "<ul><li><strong>Insert/remove a table:</strong> constant time, paid when tables are created or deleted — not during iteration.</li><li><strong>Iterate all tables with an id:</strong> a linear sweep over a packed array. This is the inner loop of uncached queries.</li><li><strong>Find one table's entry:</strong> one map lookup. This powers checks like &quot;does table T have component C, and in which column?&quot; — which is also how a query tests its remaining terms against a candidate table.</li></ul>"
      }
    ],
    related: ["sto-component-index", "queries", "internals"]
  },
  {
    id: "sto-sparse",
    parent: "storage",
    order: 5,
    title: "Sparse Storage",
    code: "STO-05",
    tagline: "Components that never move, whatever the entity does",
    intro: "A component with the <code>Sparse</code> trait is not stored in table columns. Its data lives in a <em>paged sparse set</em> owned by the component record, keyed by entity id. The entity still moves between tables when its component set changes — but the sparse component's data stays put, so pointers to it remain stable.",
    sections: [
      {
        type: "text",
        heading: "The coat check",
        html: "<p>Table storage is like carrying everything you own from room to room. Sparse storage is a coat check: your coat stays behind the counter under your ticket number, and it does not matter which room you wander into — the coat never moves.</p><p>The sparse set is <em>paged</em>: entity ids are split into pages of 64 slots, and a page is only allocated when some entity in its range actually has the component. That is why it is called sparse — a component held by 50 entities out of a million costs memory for roughly 50 slots' worth of pages, not a million.</p>"
      },
      {
        type: "diagram",
        heading: "Finding a sparse component",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "e", label: "Entity id 130", sub: "your ticket number" } ],
            [ { id: "cr", label: "Component record", sub: "owns the sparse set" } ],
            [ { id: "pg", label: "Page 2", sub: "130 >> 6" } ],
            [ { id: "sl", label: "Slot 2", sub: "130 & 63 holds the data" } ]
          ],
          edges: [
            { from: "e", to: "cr" },
            { from: "cr", to: "pg" },
            { from: "pg", to: "sl" }
          ],
          note: "No table involved: the same lookup works no matter where the entity lives."
        }
      },
      {
        type: "code",
        heading: "Marking a component sparse",
        lang: "c",
        title: "The pointer stays valid across the archetype move",
        src: "ECS_COMPONENT(world, Position);\necs_add_id(world, ecs_id(Position), EcsSparse);\n\necs_entity_t e = ecs_new(world);\necs_set(world, e, Position, {10, 20});\nconst Position *p = ecs_get(world, e, Position);\n\necs_add(world, e, Velocity);\nprintf(\"%f, %f\\n\", (double)p->x, (double)p->y);"
      },
      {
        type: "text",
        heading: "The trade-offs",
        html: "<ul><li><strong>Stable pointers.</strong> Table moves and other entities' inserts never invalidate a sparse component pointer. This also makes sparse the home for components that cannot be moved at all — non-movable C++ types are automatically marked sparse.</li><li><strong>Cheaper moves.</strong> When the entity changes tables, sparse data is not copied along.</li><li><strong>Slower queries.</strong> Iteration can no longer walk one contiguous array; each entity's data is fetched from the sparse set individually. You trade query speed for add/remove speed and stability.</li><li><strong>Still an archetype change.</strong> The Sparse trait only moves the <em>data</em> out of the table. The component id still appears in the table's type, so adding or removing it still moves the entity — and queries still match it through the normal table machinery. To avoid the table change too, you need the next page: non-fragmenting components.</li></ul>"
      }
    ],
    related: ["sto-dont-fragment", "sto-table-moves", "components"]
  },
  {
    id: "sto-dont-fragment",
    parent: "storage",
    order: 6,
    title: "Non-Fragmenting Components",
    code: "STO-06",
    tagline: "Stop rare components from shattering your tables",
    intro: "Every distinct component combination creates its own table. That is called <em>fragmentation</em>, and it is usually fine — until a component or relationship takes many different forms across few entities. The <code>DontFragment</code> trait keeps such an id out of table types entirely: it lives only in sparse storage, and tables stop splitting because of it.",
    sections: [
      {
        type: "text",
        heading: "The fragmentation problem",
        html: "<p>Tables shine when many entities share a combination. They suffer when almost nobody does. The classic trap is a relationship with many targets: give a thousand soldiers a <code>(Targeting, ...)</code> pair, each aiming at a different enemy, and you get up to a thousand tables holding one entity each.</p><p>A table of one entity still costs a table's overhead: its structs, its graph edges, its entries in every component record, and — worst — queries now iterate a thousand tables to visit a thousand entities. The per-table matching that normally amortizes over thousands of rows amortizes over one.</p>"
      },
      {
        type: "diagram",
        heading: "One entity per table",
        spec: {
          type: "grid",
          title: "Fragmented: a (Likes, *) pair in the table type",
          cols: ["Table", "Entities in it"],
          rows: [
            ["[Position, (Likes, Alice)]", "e1"],
            ["[Position, (Likes, Bob)]", "e2"],
            ["[Position, (Likes, Carol)]", "e3"],
            ["[Position]", "e4 ... e1000"]
          ],
          note: "With DontFragment on Likes, all thousand entities stay in [Position] and each Likes pair lives in sparse storage instead."
        }
      },
      {
        type: "code",
        heading: "Opting out of fragmentation",
        lang: "c",
        title: "Likes pairs no longer enter table types",
        src: "ECS_TAG(world, Likes);\necs_add_id(world, Likes, EcsDontFragment);\n\necs_entity_t alice = ecs_new(world);\necs_entity_t e = ecs_new(world);\necs_add_pair(world, e, Likes, alice);"
      },
      {
        type: "text",
        heading: "How it works, and what it costs",
        html: "<p><code>DontFragment</code> uses the same paged sparse sets as the <code>Sparse</code> trait, stored on the component record. The difference: the id never becomes part of any table type, so adding or removing it does not move the entity at all — no archetype change, no table churn.</p><ul><li><strong>Adds and removes are cheap:</strong> a sparse set insert or remove, nothing more.</li><li><strong>Queries still work,</strong> including wildcards — component records of non-fragmenting ids are linked together so <code>(Likes, *)</code> can find them. Queries that only use <code>DontFragment</code> components can use an optimized sparse evaluation path.</li><li><strong>Iteration is per-entity,</strong> like all sparse storage: you give up the contiguous-column speed for these ids.</li><li><strong>Some features don't apply:</strong> monitors compare an entity's previous and current table to detect matching changes, and non-fragmenting ids are invisible to tables, so monitors do not trigger on them.</li></ul><p>Rule of thumb: components shared by many entities in the same combinations belong in tables; ids that are rare or take many unique forms — especially relationship pairs with many targets — are candidates for <code>DontFragment</code>. The biggest built-in use is hierarchies, on the next page.</p>"
      }
    ],
    related: ["sto-sparse", "sto-parent-hierarchies", "queries"]
  },
  {
    id: "sto-parent-hierarchies",
    parent: "sto-dont-fragment",
    order: 1,
    title: "Parent Hierarchies",
    code: "STO-06A",
    tagline: "Deep trees without a table for every parent",
    intro: "A <code>(ChildOf, parent)</code> pair is part of the table type, so every distinct parent splits its children into their own tables. Great for a few huge parents, terrible for many small ones. Flecs therefore ships a second, non-fragmenting hierarchy storage: the <code>Parent</code> component, which stores the parent as plain data.",
    sections: [
      {
        type: "text",
        heading: "Two ways to say \"my parent is\"",
        html: "<p><strong>ChildOf hierarchies</strong> put the parent in the table type. All children of one parent that share components sit together in one table — perfect for a scene root with thousands of dynamically created children, and it gives queries fast per-parent access. But 500 prefab instances, each a parent of a cockpit and an engine, would mean up to 500 cockpit tables of one entity each.</p><p><strong>Parent hierarchies</strong> instead set an <code>EcsParent</code> component whose value is the parent entity. The parent is just data, so all 500 cockpits share one table regardless of whose cockpit they are. Bookkeeping lives on the ChildOf-pair's record: a map from table id to a small per-parent record counts how many children each parent has in each table.</p><p>The two mix freely under one parent, but a single entity uses one or the other — never both a <code>ChildOf</code> pair and a <code>Parent</code> component.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsParent",
        summary: "The non-fragmenting ChildOf, from include/flecs.h. The whole component is one field.",
        members: [
          { name: "value", type: "ecs_entity_t", desc: "The parent entity. Because this is component data instead of part of the table type, changing parents does not require a different table." }
        ]
      },
      {
        type: "struct",
        heading: "The bookkeeping entry",
        name: "ecs_parent_record_t",
        summary: "Stored per (parent, table) combination in the pair record's children_tables map, from include/flecs/private/api_internals.h.",
        members: [
          { name: "entity", type: "uint32_t", desc: "When the table holds exactly one child of this parent, its entity id is stored here as a fast path straight to the child." },
          { name: "count", type: "int32_t", desc: "How many children of this parent live in this table, so child iteration knows which tables to visit and how much to expect." }
        ]
      },
      {
        type: "code",
        heading: "Creating both kinds of children",
        lang: "c",
        title: "Same parent, two storages",
        src: "ecs_entity_t spaceship = ecs_new(world);\n\necs_entity_t cockpit = ecs_new_w_pair(world, EcsChildOf, spaceship);\n\necs_entity_t engine = ecs_new_w_parent(world, spaceship, \"Engine\");"
      },
      {
        type: "text",
        heading: "Choosing between them",
        html: "<p>Use <strong>ChildOf</strong> when a parent has many children, or when you cannot predict what children will exist — large, unstructured hierarchies like scenes. Use <strong>Parent</strong> when parents have a small, known set of children and the hierarchy is deep or instantiated many times — the prefab case it was built for. Instantiating a prefab tree with Parent children costs no table creation per instance, which is exactly the fragmentation the trait exists to avoid.</p>"
      }
    ],
    related: ["sto-dont-fragment", "sto-ordered-children", "world", "lifecycle"]
  },
  {
    id: "sto-ordered-children",
    parent: "storage",
    order: 7,
    title: "Ordered Children",
    code: "STO-07",
    tagline: "Keep the kids in line, even when tables shuffle",
    intro: "Table storage does not promise any entity order — swap-with-last deletes and archetype moves shuffle rows all the time. The <code>OrderedChildren</code> trait fixes that for hierarchies: add it to a parent, and its children are always returned in creation order, or in any custom order you set.",
    sections: [
      {
        type: "text",
        heading: "Why order gets lost, and how it is kept",
        html: "<p>Normally, iterating a parent's children walks the tables that contain its <code>(ChildOf, parent)</code> pair, in whatever row order those tables happen to have. Give one child a new component and it moves to another table — and suddenly it comes back in a different position. For gameplay data nobody cares; for a UI widget tree or an inventory list, order <em>is</em> the data.</p><p>With the trait, the pair's component record keeps an extra list — the <code>ordered_children</code> vector in its pair data — holding the child ids in their intended order, like a teacher's roll-call list that stays the same no matter where the students sit. Storage operations keep it up to date: appends on birth, removals on death, transfers when a child is reparented.</p>"
      },
      {
        type: "code",
        heading: "Using it",
        lang: "c",
        title: "Order survives the archetype move",
        src: "ecs_entity_t parent = ecs_new(world);\necs_add_id(world, parent, EcsOrderedChildren);\n\necs_entity_t child_1 = ecs_new_w_pair(world, EcsChildOf, parent);\necs_entity_t child_2 = ecs_new_w_pair(world, EcsChildOf, parent);\necs_entity_t child_3 = ecs_new_w_pair(world, EcsChildOf, parent);\n\necs_set(world, child_2, Position, {10, 20});\n\necs_iter_t it = ecs_children(world, parent);\nwhile (ecs_children_next(&it)) {\n  for (int i = 0; i < it.count; i++) {\n    ecs_entity_t child = it.entities[i];\n  }\n}"
      },
      {
        type: "text",
        heading: "Behavior and cost",
        html: "<ul><li><strong>One result, in order.</strong> <code>ecs_children</code> returns all children in a single result, straight from the id vector; the iterator's table pointer is NULL because results no longer come from one table.</li><li><strong>Custom order.</strong> Rearrange at will with <code>ecs_set_child_order</code>, or grab the raw ordered list with <code>ecs_get_ordered_children</code>.</li><li><strong>Scope.</strong> Only child iteration is ordered. Regular queries still return these entities in table order.</li><li><strong>Cost.</strong> Every child add, delete and reparent pays a small list update — constant-time per operation. Iteration hands you entity ids rather than table rows, so reading component data means going through the entity index per child instead of streaming columns. Reserve the trait for parents where order genuinely matters.</li></ul>"
      }
    ],
    related: ["sto-parent-hierarchies", "sto-table-anatomy", "world"]
  }
]);
