window.FLECS_TOUR.register([
  {
    id: "wld-entities",
    parent: "entities",
    order: 1,
    title: "Creating & Deleting Entities",
    code: "ENT-01",
    tagline: "Handing out ids, and taking them back",
    intro: "An entity is just a number — a ticket the world hands you that you can attach data to. Creating one is as cheap as pulling the next ticket from the dispenser: <code>ecs_new(world)</code> gives you a fresh id and stores nothing else until you add components to it.",
    sections: [
      {
        type: "text",
        heading: "The creation menu",
        html: "<p>From simplest to fanciest:</p><ul><li><code>ecs_new(world)</code> — a fresh, empty entity id.</li><li><code>ecs_new_w_id(world, component)</code> — a new entity that starts with one component or tag already added.</li><li><code>ecs_new_w_parent(world, parent, \"name\")</code> — a new (or existing) named child of a parent.</li><li><code>ecs_bulk_new_w_id(world, component, count)</code> — many entities at once, landing in the same table, much faster than a loop of <code>ecs_new_w_id</code>.</li><li><code>ecs_entity_init(world, &amp;desc)</code> — the full-service version, driven by a <code>ecs_entity_desc_t</code> struct. The <code>ecs_entity(world, { ... })</code> macro is shorthand for it. This is the one that understands names: if you give it a name and an entity with that name already exists, you get the existing entity back instead of a duplicate.</li></ul>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_entity_desc_t",
        summary: "What you fill in for ecs_entity_init() / the ecs_entity() macro. Every field is optional.",
        members: [
          { name: "_canary", type: "int32_t", desc: "A safety check. Must be 0; Flecs uses it to detect a struct that was never initialized. The C macro zeroes it for you." },
          { name: "id", type: "ecs_entity_t", desc: "Set this to modify an existing entity instead of creating a new one. Leave 0 to create." },
          { name: "parent", type: "ecs_entity_t", desc: "The parent to create the entity under. Adds a (ChildOf, parent) relationship." },
          { name: "name", type: "const char *", desc: "The entity's name. If no id is given, Flecs first looks for an existing entity with this name and returns it if found. If an id is given, the name must match the entity's existing name." },
          { name: "sep", type: "const char *", desc: "The separator used if the name is actually a path like \"parent.child\". Leave NULL for the default dot. An empty string means: treat the name as one literal string, dots and all." },
          { name: "root_sep", type: "const char *", desc: "The prefix that marks a name as starting from the root of the world instead of the current scope." },
          { name: "symbol", type: "const char *", desc: "A second, unscoped identifier, typically the C type name. Lets you find \"flecs.components.transform.Position\" by just asking for \"EcsPosition\"." },
          { name: "use_low_id", type: "bool", desc: "When true, take the id from the low range reserved for components, which several code paths can look up faster." }
        ]
      },
      {
        type: "code",
        heading: "The desc in action",
        lang: "c",
        src: "ecs_entity_t ship = ecs_entity(world, {\n  .name = \"Enterprise\"\n});\n\necs_entity_t bridge = ecs_entity(world, {\n  .name = \"Bridge\",\n  .parent = ship\n});\n\necs_entity_t same = ecs_entity(world, { .name = \"Enterprise\" });"
      },
      {
        type: "text",
        heading: "Undoing: clear, delete, clone",
        html: "<p>Three different levels of &quot;get rid of it&quot;:</p><ul><li><code>ecs_clear(world, e)</code> — strip all components off the entity, but keep the id alive. The ticket stays valid; it's just blank again.</li><li><code>ecs_delete(world, e)</code> — the entity is gone. Its components are removed, cleanup rules run (children are deleted with their parent), and the id goes back in the dispenser to be recycled. Deleting an already-dead entity is a harmless no-op.</li><li><code>ecs_delete_with(world, component)</code> — bulk delete every entity that has a given component or pair. Wildcards allowed.</li></ul><p>And one level of &quot;make another one&quot;: <code>ecs_clone(world, dst, src, copy_value)</code> copies an entity's components to another entity (or a new one if <code>dst</code> is 0). Pass <code>copy_value = true</code> to copy the data too, not just the component list. The name is deliberately <em>not</em> cloned — two siblings can't share a name.</p>"
      }
    ],
    related: ["wld-liveness", "wld-entity-ids", "sto-entity-index", "lif-deferring", "cmp-cleanup-traits"]
  },
  {
    id: "wld-liveness",
    parent: "wld-entities",
    order: 1,
    title: "Entity Liveness",
    code: "ENT-01A",
    tagline: "Is this ticket still valid?",
    intro: "Because entity ids get reused after deletion, Flecs needs a way to tell a live entity from a stale id someone kept lying around. That's <em>liveness</em>: every id is either alive (safe to use) or dead (points at something that was deleted). Asking is cheap, and there's a whole little API for it.",
    sections: [
      {
        type: "diagram",
        heading: "The life of an id",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "v1", label: "Unused", sub: "never handed out" } ],
            [ { id: "v2", label: "Alive", sub: "ecs_new() returned it" } ],
            [ { id: "v3", label: "Dead", sub: "ecs_delete() was called" } ],
            [ { id: "v4", label: "Alive again", sub: "recycled, new generation" } ]
          ],
          edges: [
            { from: "v1", to: "v2", label: "create" },
            { from: "v2", to: "v3", label: "delete" },
            { from: "v3", to: "v4", label: "recycle" }
          ],
          note: "The recycled id has the same lower 32 bits but a bumped generation, so old copies of it test as not alive."
        }
      },
      {
        type: "text",
        heading: "The liveness toolbox",
        html: "<p>Each function answers a slightly different question:</p><ul><li><code>ecs_is_alive(world, e)</code> — is this exact id (generation included) currently alive? The everyday check.</li><li><code>ecs_is_valid(world, e)</code> — like <code>is_alive</code>, but also tolerates garbage: it returns false for 0 and for ids with a bad bit pattern instead of panicking. Use it when you can't trust where the id came from.</li><li><code>ecs_exists(world, e)</code> — has this id ever been issued, ignoring the generation? True even for dead ids.</li><li><code>ecs_get_alive(world, e)</code> — you have an id with the generation stripped off (this happens when ids are stored inside pairs); this gives you back the currently-alive version of it, or 0.</li></ul>"
      },
      {
        type: "text",
        heading: "Forcing an id to live",
        html: "<p>Sometimes the id comes from outside the world: a network message, a save file, a hardcoded constant. The world has never handed it out, so it's not alive — but you need it to be. <code>ecs_make_alive(world, e)</code> tells the world: this id exists now, trust me. It creates the entity with exactly that id and generation.</p><p>The rules keep you honest: if the id is already alive with a <em>different</em> generation, the operation fails, because you'd be resurrecting the dead. <code>ecs_make_alive_id()</code> is the variant for component ids and pairs (which can't carry generations), and <code>ecs_set_version(world, e)</code> is the sledgehammer that overwrites the generation of a live entity — meant for netcode and external id pools that own the truth about generations.</p>"
      },
      {
        type: "code",
        heading: "Liveness in five lines",
        lang: "c",
        src: "ecs_entity_t e1 = ecs_new(world);\necs_is_alive(world, e1);          // true\necs_delete(world, e1);\necs_is_alive(world, e1);          // false\n\necs_entity_t e2 = ecs_new(world); // recycles e1's number\necs_is_alive(world, e2);          // true\necs_is_alive(world, e1);          // still false"
      }
    ],
    related: ["wld-generations", "wld-entity-ids", "sto-entity-index"]
  },
  {
    id: "wld-entity-ids",
    parent: "wld-entities",
    order: 2,
    title: "Anatomy of an Entity Id",
    code: "ENT-01B",
    tagline: "64 bits, three jobs",
    intro: "An <code>ecs_entity_t</code> is a plain 64-bit number, but the bits are split into fields, like a phone number that encodes both the country and the person. The bottom half says <em>which</em> entity; the top half says <em>which lifetime</em> of that entity, plus a few flag bits Flecs uses for special id types.",
    sections: [
      {
        type: "diagram",
        heading: "The bit layout",
        spec: {
          type: "grid",
          title: "One ecs_entity_t, bit by bit",
          cols: ["Bits", "Field", "What it means"],
          rows: [
            ["0 .. 31", "Index", "The actual entity number. This is what uniquely identifies the entity in the world."],
            ["32 .. 47", "Generation", "How many times this index has been recycled. Bumped on every delete."],
            ["48 .. 59", "Unused", "Reserved."],
            ["60 .. 63", "Id flags", "Markers like PAIR, TOGGLE and AUTO_OVERRIDE, used when the number acts as a component id."]
          ],
          note: "Masks from the source: ECS_ENTITY_MASK = 0xFFFFFFFF, ECS_GENERATION_MASK = 0xFFFF << 32, ECS_ID_FLAGS_MASK = top bits from 60."
        }
      },
      {
        type: "text",
        heading: "Why a plain integer?",
        html: "<p>Because integers are the perfect handle: they're tiny, trivially copyable, storable in files and network packets, and comparable with <code>==</code>. There's no pointer to dangle and no object to keep alive. All the world needs to find everything about an entity is the lower 32 bits, used as an index into its entity records.</p><p>The upper bits are how one number can wear different hats. The same 64-bit value type (<code>ecs_id_t</code> is an alias of <code>ecs_entity_t</code>) is also used for <em>component ids</em>, where the flag bits come into play: the <code>PAIR</code> flag turns the number into a relationship pair holding two 32-bit entity indexes, and <code>TOGGLE</code> and <code>AUTO_OVERRIDE</code> modify how a component behaves. That's also why pairs can't store generations — each half of the pair only has 32 bits to work with, which is exactly the problem <code>ecs_get_alive()</code> solves.</p>"
      },
      {
        type: "code",
        heading: "Poking at the bits",
        lang: "c",
        src: "ecs_entity_t e = ecs_new(world);\n\nuint32_t index = (uint32_t)e;\nuint32_t gen = ecs_get_version(e);\n\necs_id_t bare = ecs_strip_generation(e);\necs_entity_t live = ecs_get_alive(world, bare);"
      }
    ],
    related: ["wld-generations", "wld-liveness", "components", "cmp-pair-ids"]
  },
  {
    id: "wld-generations",
    parent: "wld-entity-ids",
    order: 1,
    title: "Generations",
    code: "ENT-01B1",
    tagline: "Why reusing an id doesn't resurrect the dead",
    intro: "When an entity is deleted, its number goes back into the pool and will be handed out again. That's a problem if some old piece of code kept the number: it would suddenly point at a completely different entity. Generations fix this — every recycle stamps the id with a new lifetime counter, like an apartment that keeps its street address but changes the name on the doorbell.",
    sections: [
      {
        type: "diagram",
        heading: "One index, many lifetimes",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "g1", label: "500, gen 0", sub: "ecs_new() returns it" } ],
            [ { id: "g2", label: "deleted", sub: "index 500 goes in the recycle bin" } ],
            [ { id: "g3", label: "500, gen 1", sub: "next ecs_new() returns it" } ],
            [ { id: "g4", label: "is_alive?", sub: "gen 0: no. gen 1: yes" } ]
          ],
          edges: [
            { from: "g1", to: "g2", label: "ecs_delete" },
            { from: "g2", to: "g3", label: "ecs_new" },
            { from: "g3", to: "g4" }
          ],
          note: "Both ids share the lower 32 bits. Only the generation in bits 32-47 differs — and that's enough to tell them apart."
        }
      },
      {
        type: "text",
        heading: "How it works",
        html: "<p>The world remembers the current generation for every index it has ever issued. Every liveness check compares the generation inside your id against the stored one; if they differ, your id belongs to a past life and <code>ecs_is_alive()</code> says false. Operations on dead ids fail loudly instead of corrupting some stranger's data — a <em>use-after-free</em> bug (using memory after it was given back) becomes a clean, detectable error.</p><p>Two consequences worth knowing:</p><ul><li><strong>Recycled ids look huge.</strong> A bumped generation lives in the upper bits, so the very first recycle makes the id larger than 4 billion. Completely normal; the index in the low bits is still small.</li><li><strong>The counter is 16 bits.</strong> After 65,536 deletes of the same index it wraps around. In theory an ancient stale id could then collide; in practice this needs billions of deletes of the same slot to matter.</li></ul><p><code>ecs_get_version(e)</code> reads the counter, <code>ecs_strip_generation(e)</code> removes it, and <code>ecs_set_version(world, e)</code> overwrites it when an external system (like a network authority) owns the truth.</p>"
      }
    ],
    related: ["wld-liveness", "wld-entity-ids", "wld-ranges", "sto-entity-index"]
  },
  {
    id: "wld-ranges",
    parent: "entities",
    order: 2,
    title: "Entity Ranges",
    code: "ENT-02",
    tagline: "Reserved seating for entity ids",
    intro: "Normally the world hands out entity ids in whatever order it likes. The entity ranges addon lets you fence off a block of ids — &quot;from now on, only issue ids between 1&nbsp;million and 2&nbsp;million&quot; — like assigning each airline its own block of flight numbers so two airlines never announce the same flight.",
    sections: [
      {
        type: "text",
        heading: "Why you'd want this",
        html: "<p>The classic use case is multiplayer. If the server creates entities and so does each client, the same id could mean a different entity on every machine — chaos. Give the server ids 1M-2M and each client its own slice above that, and any entity id is unambiguous everywhere; the server can replicate &quot;entity 1500000 took damage&quot; and every machine agrees who that is.</p><p>The same trick works for any id partitioning: separating streamed-in level content from runtime entities, or keeping ids from a savefile clear of freshly created ones.</p>"
      },
      {
        type: "code",
        heading: "Fencing off a range",
        lang: "c",
        src: "const ecs_entity_range_t *server_ids =\n  ecs_entity_range_new(world, 1000000, 2000000);\n\necs_entity_range_set(world, server_ids);\n\necs_entity_t e = ecs_new(world);\n\nconst ecs_entity_range_t *active = ecs_entity_range_get(world);"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_entity_range_t",
        summary: "One block of reserved ids, created with ecs_entity_range_new() and activated with ecs_entity_range_set().",
        members: [
          { name: "min", type: "uint32_t", desc: "First id in the range (inclusive) — where the dispenser starts." },
          { name: "max", type: "uint32_t", desc: "Last id in the range (inclusive). 0 means no upper limit." },
          { name: "cur", type: "uint32_t", desc: "The last id this range handed out — its bookmark." },
          { name: "recycled", type: "ecs_vec_t", desc: "This range's own recycle bin of deleted ids, so recycled ids also stay inside the fence." }
        ]
      },
      {
        type: "text",
        heading: "The rules",
        html: "<p>Ranges are deliberately strict:</p><ul><li>Only ranges created by <code>ecs_entity_range_new()</code> can be activated, and once created a range can't be deleted — it lives as long as the world.</li><li>Each range keeps its <em>own</em> list of recycled ids. Delete an entity while a range is active and its id goes back into that range's bin, never into another range's.</li><li>You can switch between ranges at will (server range while applying network updates, local range for everything else). Only one is active at a time; <code>ecs_entity_range_get()</code> tells you which.</li><li>If the active range runs out of ids, entity creation asserts — the fence doesn't quietly move.</li></ul><p>The addon is compiled in with the <code>FLECS_ENTITY_RANGES</code> define.</p>"
      }
    ],
    related: ["wld-entity-ids", "wld-liveness", "remote", "sto-entity-index"]
  },
  {
    id: "wld-names",
    parent: "entities",
    order: 3,
    title: "Names & Paths",
    code: "ENT-03",
    tagline: "Because \"542\" is a terrible thing to call a spaceship",
    intro: "Entities are numbers, but you can give any entity a human-readable <em>name</em> and find it back with a <em>path</em> — a dotted trail through its parents, like a file path: <code>ships.Enterprise.Bridge</code>. Names are optional, unique among siblings, and — true to Flecs form — stored as ordinary component data on the entity itself.",
    sections: [
      {
        type: "code",
        heading: "Naming and finding",
        lang: "c",
        src: "ecs_entity_t e = ecs_entity(world, { .name = \"Enterprise\" });\n\nconst char *name = ecs_get_name(world, e);\n\necs_entity_t found = ecs_lookup(world, \"Enterprise\");\n\necs_set_name(world, e, \"Defiant\");\n\nchar *path = ecs_get_path(world, e);\necs_os_free(path);"
      },
      {
        type: "text",
        heading: "Where names live",
        html: "<p>A name is not some hidden field in the world — it's a component. When you name an entity, Flecs sets the pair <code>(Identifier, Name)</code> on it, where <code>Identifier</code> is a built-in component holding a string and <code>Name</code> is a tag saying which <em>kind</em> of identifier this is. The same <code>Identifier</code> component, paired with different tags, also stores an entity's <em>symbol</em> and <em>alias</em> — same filing cabinet, three different drawers.</p><p>Alongside the string, the component keeps a hash and a pointer into a per-parent index, which is how lookups by name are fast: each parent keeps a hashmap from name to child.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsIdentifier",
        summary: "The built-in component that stores a name, symbol or alias, depending on which tag it's paired with.",
        members: [
          { name: "value", type: "char *", desc: "The identifier string itself — the actual name." },
          { name: "length", type: "ecs_size_t", desc: "Length of the string, so it never has to be recounted." },
          { name: "hash", type: "uint64_t", desc: "A hash of the current value, for fast comparisons during lookup." },
          { name: "index_hash", type: "uint64_t", desc: "The hash under which this entity is currently filed in the lookup index." },
          { name: "index", type: "ecs_hashmap_t *", desc: "The lookup index (a name-to-entity hashmap) this identifier is registered in." }
        ]
      },
      {
        type: "diagram",
        heading: "Names are just data",
        spec: {
          type: "grid",
          title: "The entity's own components hold its identity",
          cols: ["Entity", "(Identifier, Name)", "(Identifier, Symbol)", "(ChildOf, ships)"],
          rows: [
            ["542", "\"Enterprise\"", "", "yes"],
            ["543", "\"Defiant\"", "", "yes"],
            ["12", "\"Position\"", "\"EcsPosition\"", ""]
          ],
          note: "Rename an entity and you're just writing a component. Delete the pair and the entity is anonymous again."
        }
      },
      {
        type: "text",
        heading: "The rules",
        html: "<p>A few rules keep names sane:</p><ul><li><strong>Unique among siblings.</strong> Two entities can both be called <code>Bridge</code> — as long as they have different parents. The full path is what's globally unique.</li><li><strong>Paths use dots.</strong> <code>ecs_lookup(world, \"ships.Enterprise.Bridge\")</code> walks the hierarchy one name at a time. Other separators are possible via the <code>_w_sep</code> function variants.</li><li><strong>Find-or-create.</strong> <code>ecs_entity_init()</code> with a name first looks the name up, and only creates a new entity if nothing was found — so declaring the same named entity twice gives you the same entity.</li><li><strong>Names die with the entity.</strong> Delete the entity and the name is released and can be reused.</li></ul><p>The children of this page cover the two remaining identifier kinds and the exact search rules lookups follow.</p>"
      }
    ],
    related: ["wld-symbols-aliases", "wld-lookups", "wld-hierarchies", "obs-doc"]
  },
  {
    id: "wld-symbols-aliases",
    parent: "wld-names",
    order: 1,
    title: "Symbols & Aliases",
    code: "ENT-03A",
    tagline: "Nicknames for entities with long addresses",
    intro: "Besides its name, an entity can carry two more identifiers. A <em>symbol</em> is an unscoped, technical identifier — typically the C type name of a component. An <em>alias</em> is a nickname: a shortcut that lets you find a deeply nested entity from the root without typing its full path.",
    sections: [
      {
        type: "text",
        heading: "Symbols: the C-name escape hatch",
        html: "<p>Suppose a module registers its position component as <code>flecs.components.transform.Position</code>. Pretty path — but your C code knows the type as <code>EcsPosition</code>, and those two strings have nothing to do with each other. The symbol bridges the gap: the entity's <em>name</em> is the scoped path, its <em>symbol</em> is the language-level identifier.</p><p><code>ecs_set_symbol(world, e, \"EcsPosition\")</code> stores it (as the pair <code>(Identifier, Symbol)</code>), and <code>ecs_lookup_symbol(world, \"EcsPosition\", ...)</code> finds it again — ignoring hierarchy entirely, since symbols live in one world-wide index. This is the machinery that lets Flecs match a registered component to its C type across modules and even across binaries.</p>"
      },
      {
        type: "text",
        heading: "Aliases: shortcuts for humans",
        html: "<p><code>ecs_set_alias(world, e, \"ship\")</code> registers a nickname in the root scope. From then on, <code>ecs_lookup(world, \"ship\")</code> finds the entity no matter how deep in the hierarchy it actually lives — like a desktop shortcut to a file buried ten folders down. An entity can have only one alias, and it's stored as the pair <code>(Identifier, Alias)</code>.</p>"
      },
      {
        type: "code",
        heading: "All three identifiers on one entity",
        lang: "c",
        src: "ecs_entity_t pos = ecs_entity(world, {\n  .name = \"transform.Position\",\n  .symbol = \"EcsPosition\"\n});\n\necs_set_alias(world, pos, \"Pos\");\n\necs_lookup(world, \"transform.Position\");\necs_lookup_symbol(world, \"EcsPosition\", false, false);\necs_lookup(world, \"Pos\");"
      }
    ],
    related: ["wld-names", "wld-lookups", "reflection"]
  },
  {
    id: "wld-lookups",
    parent: "wld-names",
    order: 2,
    title: "How Lookups Search",
    code: "ENT-03B",
    tagline: "Where Flecs looks when you ask for a name",
    intro: "When you call <code>ecs_lookup(world, \"Bridge\")</code>, the world doesn't just check one place. Like asking for a book at a library desk, the search starts at the nearest shelf and widens: current scope first, then each parent scope up to the root, then the built-in <code>flecs.core</code> shelf.",
    sections: [
      {
        type: "text",
        heading: "The search order",
        html: "<p><code>ecs_lookup(world, path)</code> is shorthand for <code>ecs_lookup_path_w_sep(world, 0, path, \".\", NULL, true)</code>. The full version exposes every knob:</p><ul><li><strong>parent</strong> — where the search starts. 0 means the current scope (or the root if no scope is set).</li><li><strong>sep</strong> — the separator that splits the path into names; dot by default.</li><li><strong>prefix</strong> — a marker that, when the path starts with it, forces the search to begin at the root.</li><li><strong>recursive</strong> — the interesting one. When true and the path isn't found under the starting parent, the search moves to the parent's parent, and so on up to the root — the way a variable name in most programming languages is looked up in enclosing scopes. As a last resort, the default search path also checks <code>flecs.core</code>, which is why built-ins like <code>ChildOf</code> resolve from anywhere.</li></ul><p><code>ecs_lookup_child(world, parent, \"name\")</code> skips all of that and checks exactly one scope — one hashmap probe, no walking.</p>"
      },
      {
        type: "code",
        heading: "Scoped lookups",
        lang: "c",
        src: "ecs_entity_t ship = ecs_entity(world, { .name = \"Enterprise\" });\necs_entity_t bridge = ecs_entity(world, {\n  .name = \"Bridge\", .parent = ship\n});\n\necs_lookup(world, \"Enterprise.Bridge\");\necs_lookup_child(world, ship, \"Bridge\");\necs_lookup_path_w_sep(world, ship, \"Bridge\", \".\", NULL, true);"
      },
      {
        type: "text",
        heading: "Tuning the search path",
        html: "<p>The list of fallback scopes is itself configurable with <code>ecs_set_lookup_path()</code>, which takes a 0-terminated array of scope entities to try (evaluated last to first). The default search path contains <code>flecs.core</code>; if you replace it, keep <code>EcsFlecsCore</code> in the list or lookups of built-in names will start failing in surprising places. Like <code>ecs_set_scope()</code>, it returns the previous value so you can restore it — and it's per-stage, so worker threads each have their own.</p><p>Cost intuition: every path segment is one hashmap lookup in a parent's name index. Lookups are cheap, but they're string operations — cache the entity id instead of looking up the same name every frame.</p>"
      }
    ],
    related: ["wld-names", "wld-scopes", "wld-hierarchies"]
  },
  {
    id: "wld-hierarchies",
    parent: "entities",
    order: 4,
    title: "Hierarchies",
    code: "ENT-04",
    tagline: "Entities all the way down: parents, children, family trees",
    intro: "Entities can be arranged in parent-child trees, like folders inside folders: a spaceship contains a cockpit, the cockpit contains a pilot seat. In Flecs this isn't a separate tree structure bolted on the side — a hierarchy is just entities connected by the built-in <code>ChildOf</code> relationship, queryable like any other data.",
    sections: [
      {
        type: "code",
        heading: "Building a family",
        lang: "c",
        src: "ecs_entity_t spaceship = ecs_entity(world, { .name = \"Spaceship\" });\n\necs_entity_t cockpit = ecs_entity(world, {\n  .name = \"Cockpit\", .parent = spaceship\n});\n\necs_entity_t seat = ecs_new_w_pair(world, EcsChildOf, cockpit);\n\necs_entity_t parent = ecs_get_parent(world, seat);"
      },
      {
        type: "diagram",
        heading: "It's pairs all the way down",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "h1", label: "Spaceship", sub: "no parent" } ],
            [ { id: "h2", label: "Cockpit", sub: "(ChildOf, Spaceship)" } ],
            [ { id: "h3", label: "Seat", sub: "(ChildOf, Cockpit)" },
              { id: "h4", label: "Controls", sub: "(ChildOf, Cockpit)" } ]
          ],
          edges: [
            { from: "h2", to: "h1", label: "ChildOf" },
            { from: "h3", to: "h2", label: "ChildOf" },
            { from: "h4", to: "h2", label: "ChildOf" }
          ],
          note: "The whole tree is stored as ordinary relationship pairs on the child entities."
        }
      },
      {
        type: "text",
        heading: "What ChildOf gives you",
        html: "<p>Because <code>ChildOf</code> is a relationship with a few special traits pre-installed, hierarchies come with batteries included:</p><ul><li><strong>One parent at a time.</strong> Adding a second <code>ChildOf</code> pair replaces the first — an entity can't be in two folders at once.</li><li><strong>Children die with their parent.</strong> <code>ChildOf</code> carries an <code>(OnDeleteTarget, Delete)</code> cleanup rule: delete the spaceship and the cockpit, seat and controls are deleted too, deepest first.</li><li><strong>Paths follow the tree.</strong> Named children are reachable as <code>Spaceship.Cockpit.Seat</code>, and <code>ecs_get_path()</code> reconstructs the path from any entity.</li><li><strong>Iteration is built in.</strong> <code>ecs_children(world, parent)</code> returns an iterator over direct children; walk it with <code>ecs_children_next()</code>. Need a stable, application-controlled order? Add the <code>OrderedChildren</code> tag to the parent.</li><li><strong>Queries understand it.</strong> Queries can match components from parents and traverse the tree — the Queries deck covers that superpower.</li></ul>"
      },
      {
        type: "code",
        heading: "Iterating children",
        lang: "c",
        src: "ecs_iter_t it = ecs_children(world, spaceship);\nwhile (ecs_children_next(&it)) {\n  for (int i = 0; i < it.count; i ++) {\n    ecs_entity_t child = it.entities[i];\n    printf(\"%s\\n\", ecs_get_name(world, child));\n  }\n}"
      }
    ],
    related: ["wld-scopes", "wld-names", "components", "queries", "sto-parent-hierarchies", "qry-cascade", "sto-ordered-children"]
  },
  {
    id: "wld-scopes",
    parent: "wld-hierarchies",
    order: 1,
    title: "Scopes",
    code: "ENT-04A",
    tagline: "The world's idea of a current directory",
    intro: "A <em>scope</em> is the world's current working folder. Set it to an entity, and everything you create afterwards automatically becomes a child of that entity, while name lookups start their search there. It's exactly like <code>cd</code> in a terminal: you step into a folder, and everything you do happens inside it.",
    sections: [
      {
        type: "code",
        heading: "cd, mkdir, cd back",
        lang: "c",
        src: "ecs_entity_t ship = ecs_entity(world, { .name = \"Enterprise\" });\n\necs_entity_t prev = ecs_set_scope(world, ship);\n\necs_entity_t bridge = ecs_entity(world, { .name = \"Bridge\" });\necs_entity_t engine = ecs_entity(world, { .name = \"Engine\" });\n\necs_set_scope(world, prev);\n\necs_lookup(world, \"Enterprise.Bridge\");"
      },
      {
        type: "text",
        heading: "The fine print",
        html: "<p>Details that matter in practice:</p><ul><li><code>ecs_set_scope()</code> returns the <em>previous</em> scope. Always save it and restore it when you're done — like returning to the directory you came from — or you'll leave the world pointing at your folder and confuse whoever runs next.</li><li>The scope affects <code>ecs_entity_init()</code> (and everything built on it) and name lookups. It deliberately does <em>not</em> affect <code>ecs_new()</code> and <code>ecs_new_low_id()</code>, which always hand out a bare, parentless id.</li><li>The scope is per <em>stage</em>, not truly global: each worker thread has its own, so threads can't trample each other's current directory.</li><li>This is how modules keep their contents namespaced — importing a module sets the scope to the module entity, registers everything, and restores the scope afterwards. The bootstrap itself does this with <code>flecs.core</code>.</li></ul>"
      }
    ],
    related: ["wld-hierarchies", "wld-lookups", "systems", "scr-hierarchies"]
  },
  {
    id: "lif-prefabs",
    parent: "entities",
    order: 5,
    title: "Prefabs",
    code: "ENT-05",
    tagline: "Cookie cutters for entities",
    intro: "A prefab is an entity you use as a template: build a &quot;SpaceShip&quot; once, with all its components, then stamp out as many instances as you like with a single operation. Prefabs live in the world like any other entity — but queries politely pretend they don't exist.",
    sections: [
      {
        type: "text",
        heading: "The cookie cutter and the dough",
        html: "<p>A prefab is a regular entity with the builtin <code>Prefab</code> tag (available with the <code>FLECS_PREFAB</code> addon, on by default). The tag changes one thing: <strong>queries skip prefabs</strong>. Your movement system won't accidentally fly the SpaceShip template around, even though it has Position and Velocity like the real ships.</p><p>To stamp out an instance, add an <code>IsA</code> pair pointing at the prefab. The instance receives the prefab's components — copied or shared, depending on each component's traits — and is a perfectly normal entity that queries <em>do</em> see.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "build a template, stamp two ships",
        src: "ecs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\n\necs_set(world, SpaceShip, Defense, {50});\necs_set(world, SpaceShip, Health, {100});\n\necs_entity_t inst_1 = ecs_new_w_pair(world, EcsIsA, SpaceShip);\necs_entity_t inst_2 = ecs_new_w_pair(world, EcsIsA, SpaceShip);\n\nconst Defense *d = ecs_get(world, inst_1, Defense);"
      },
      {
        type: "text",
        heading: "Seeing prefabs anyway",
        html: "<p>Sometimes you want to query prefabs — an editor listing all templates, for instance. Three ways in:</p><ul><li>Add <code>EcsPrefab</code> as a term: the query now matches <em>only</em> prefabs.</li><li>Make that term <em>optional</em>: the query matches both regular entities and prefabs.</li><li>Set the <code>EcsQueryMatchPrefab</code> flag on the query: same result as the optional term, slightly faster because no field needs to be populated.</li></ul><p>One nuance: prefabs are only hidden when matched on the default <code>$this</code> term source. Components reached through traversal, a fixed source or another variable are not filtered.</p>"
      }
    ],
    related: ["lif-inheritance", "lif-prefab-hierarchies", "queries", "script", "cmp-inheritance-traits", "scr-templates"]
  },
  {
    id: "lif-inheritance",
    parent: "lif-prefabs",
    order: 1,
    title: "Inheritance",
    code: "ENT-05A",
    tagline: "Copy it, share it, or keep it to yourself",
    intro: "What happens to each component when a prefab is instantiated is decided by its <code>OnInstantiate</code> trait: <em>Override</em> copies the value onto the instance, <em>Inherit</em> shares one value across all instances, and <em>DontInherit</em> keeps it on the prefab only.",
    sections: [
      {
        type: "text",
        heading: "The three behaviors",
        html: "<p>The trait is a pair you add to the <em>component</em>, like <code>(OnInstantiate, Inherit)</code>:</p><ul><li><strong>Override (the default).</strong> The value is copied from prefab to instance at instantiation. Each instance owns its copy from the start. The component must be copyable.</li><li><strong>Inherit.</strong> The value stays on the prefab, stored once in memory, and instances <em>share</em> it. <code>ecs_get</code>, <code>ecs_has</code> and queries automatically follow the <code>IsA</code> relationship to find it. Perfect for static data like meshes, materials, or base stats.</li><li><strong>DontInherit.</strong> Instances neither copy nor see the component. <code>has</code> and <code>get</code> return nothing, and it can't be overridden manually.</li></ul><p>Use <code>ecs_owns</code> to ask whether an instance has its own copy, and <code>ecs_get_target_for</code> to find which base entity a component is inherited from.</p>"
      },
      {
        type: "diagram",
        heading: "One shared value, many readers",
        spec: {
          type: "grid",
          title: "Defense has (OnInstantiate, Inherit)",
          cols: ["Entity", "Defense", "Health"],
          rows: [
            ["SpaceShip (prefab)", "50 (the only copy)", "100"],
            ["inst_1", "reads prefab's 50", "100 (own copy)"],
            ["inst_2", "overridden: 75", "100 (own copy)"],
            ["inst_3", "reads prefab's 50", "100 (own copy)"]
          ],
          note: "Health uses the default Override trait, so every instance got its own copy. Defense is stored once; only inst_2 pays for its own value."
        }
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "one value on the prefab, read by every instance",
        src: "ecs_add_pair(world, ecs_id(Defense), EcsOnInstantiate, EcsInherit);\n\necs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\necs_set(world, SpaceShip, Defense, {50});\n\necs_entity_t inst = ecs_new_w_pair(world, EcsIsA, SpaceShip);\n\nconst Defense *d = ecs_get(world, inst, Defense);\n\necs_has(world, inst, Defense);\necs_owns(world, inst, Defense);\n\necs_get_target_for(world, inst, EcsIsA, Defense);"
      },
      {
        type: "text",
        heading: "Where the value actually lives",
        html: "<p>An inherited component is stored once, on the prefab, and instances reach it through their <code>IsA</code> pair. Flecs does not walk that pair on every <code>get</code>: a table whose entities inherit from a base keeps cached references to the base's component values, so an inherited read costs about the same as an owned one.</p><p>That is also why inheritance is a query feature, not just a lookup feature. Terms for a component with <code>(OnInstantiate, Inherit)</code> default to searching the entity first and then up the <code>IsA</code> chain, so a system asking for <code>Defense</code> matches instances that never had their own copy.</p>"
      }
    ],
    related: ["ent-overriding", "ent-prefab-variants", "cmp-inheritance-traits", "qry-traversal"]
  },
  {
    id: "ent-overriding",
    parent: "lif-prefabs",
    order: 2,
    title: "Overriding",
    code: "ENT-05B",
    tagline: "When one instance wants its own copy after all",
    intro: "An instance that <em>inherits</em> a component is reading the prefab's single shared value. The moment you add or set that component on the instance itself, it stops reading and starts owning: it gets its own copy, and changes to the prefab no longer reach it. That is an <em>override</em>.",
    sections: [
      {
        type: "text",
        heading: "Taking your own copy",
        html: "<p>Think of a shared recipe pinned to the kitchen wall. Everyone cooks from it until one cook writes their own version on a card and keeps it in their pocket. From then on, that cook reads their card, and edits to the wall recipe pass them by.</p><p>You override by simply adding or setting the component on the instance:</p><ul><li><code>ecs_add</code> creates the override and <strong>initializes it with the prefab's current value</strong>, so you can start from the base and tweak.</li><li><code>ecs_set</code> creates the override and writes your value in one step.</li><li><code>ecs_remove</code> takes the override away again — the instance goes back to reading the prefab's shared value, and an <code>OnSet</code> event fires, because the value the entity effectively has just changed.</li></ul><p>Ask <code>ecs_owns</code> whether an instance has its own copy, as opposed to <code>ecs_has</code>, which is happy either way.</p>"
      },
      {
        type: "code",
        heading: "Override one instance",
        lang: "c",
        title: "Two instances, one of them opinionated",
        src: "ecs_add_pair(world, ecs_id(Defense), EcsOnInstantiate, EcsInherit);\n\necs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\necs_set(world, SpaceShip, Defense, {50});\n\necs_entity_t inst_a = ecs_new_w_pair(world, EcsIsA, SpaceShip);\necs_entity_t inst_b = ecs_new_w_pair(world, EcsIsA, SpaceShip);\n\necs_set(world, inst_a, Defense, {75});\n\necs_owns(world, inst_a, Defense);\necs_owns(world, inst_b, Defense);"
      },
      {
        type: "diagram",
        heading: "Who reads what",
        spec: {
          type: "grid",
          title: "After overriding Defense on inst_a",
          cols: ["Entity", "owns Defense?", "Value read", "Stored where"],
          rows: [
            ["SpaceShip (prefab)", "yes", "50", "prefab's table"],
            ["inst_a", "yes", "75", "inst_a's own column"],
            ["inst_b", "no", "50", "the prefab's single copy"]
          ],
          note: "Change the prefab's Defense to 60 and inst_b follows along; inst_a does not."
        }
      },
      {
        type: "text",
        heading: "Auto overriding: decide it up front",
        html: "<p>Sometimes a component is inheritable in general, but one particular prefab wants every instance to own it from birth — say a Health value that each ship must be able to lose independently. Flag it on the prefab with an <em>auto override</em> and instantiation copies it instead of sharing it:</p><ul><li><code>ecs_auto_override(world, SpaceShip, Defense)</code> marks a component the prefab already has.</li><li><code>ecs_set_auto_override(world, SpaceShip, Defense, {50})</code> sets the value and marks it in one call.</li><li>Under the hood this adds the id with the <code>ECS_AUTO_OVERRIDE</code> bit set, which is why it works for pairs too, and even for components the prefab does not have — instances then get a default-constructed one.</li></ul><p>The flag lives on the prefab, so it applies to every instance, and to instances of variants further down the chain.</p>"
      },
      {
        type: "text",
        heading: "Things worth knowing",
        html: "<ul><li>Overriding only means something for components with <code>(OnInstantiate, Inherit)</code>. With the default <code>Override</code> trait every instance already owns a copy; with <code>DontInherit</code> there is nothing to override.</li><li>An override changes the instance's table, because it now genuinely has the component. That is a structural change, so inside a system it is deferred like any other.</li><li>Adding the override fires <code>OnAdd</code> and <code>OnSet</code>; removing it fires <code>OnRemove</code>, and then <code>OnSet</code> for the value that becomes visible again.</li><li>Overrides are per component, not per prefab: an instance can own two components and inherit five others.</li></ul>"
      }
    ],
    related: ["lif-inheritance", "cmp-inheritance-traits", "ent-prefab-variants", "evt-builtin-events"]
  },
  {
    id: "lif-prefab-hierarchies",
    parent: "lif-prefabs",
    order: 3,
    title: "Hierarchies & Slots",
    code: "ENT-05C",
    tagline: "Stamp the whole ship, cockpit included",
    intro: "When a prefab has children — a SpaceShip with a Cockpit and an Engine — instantiating it copies the entire subtree. Every instance gets its own cockpit, and slots let you find it without searching by name.",
    sections: [
      {
        type: "text",
        heading: "The whole tree comes along",
        html: "<p>Prefab hierarchies are built exactly like entity hierarchies, with <code>ChildOf</code>. Children of a prefab automatically get the <code>Prefab</code> tag too, so the template's parts stay invisible to queries.</p><p>On instantiation the subtree is <em>copied</em>: unlike the instance itself, which can inherit components from the prefab, child entities never inherit from prefab children — each instance's cockpit is a full, independent entity. You can find it by name with <code>ecs_lookup_child(world, inst, &quot;Cockpit&quot;)</code>.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "prefab child, found on the instance",
        src: "ecs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\n\necs_entity_t Cockpit = ecs_new_w_parent(world, SpaceShip, \"Cockpit\");\n\necs_entity_t inst = ecs_new_w_pair(world, EcsIsA, SpaceShip);\n\necs_entity_t by_name = ecs_lookup_child(world, inst, \"Cockpit\");\necs_entity_t by_slot = ecs_get_target(world, inst, Cockpit, 0);"
      },
      {
        type: "text",
        heading: "Slots: name-free lookups",
        html: "<p>Looking children up by name works, but it's string-based and breaks if names change. Prefab hierarchies created through the <code>Parent</code> component (which <code>ecs_new_w_parent</code> uses) also support <strong>slots</strong>: you can ask <code>ecs_get_target(world, inst, Cockpit, 0)</code> — using the <em>prefab child</em> as the relationship — and get back the matching child of <em>this instance</em>.</p><p>Flecs keeps an index from each prefab child to its position among the instance's children, so the lookup is fast. Two caveats from how it's implemented: the prefab child must still be a prefab with its original parent, and it must be resolved on an actual instance whose children haven't been rearranged since instantiation.</p><p>Auto overrides work on children too: adding an auto override for a component to a prefab child — even one that doesn't have the component — adds a default-constructed component to the instance's child.</p>"
      }
    ],
    related: ["lif-prefabs", "lif-inheritance", "world", "wld-hierarchies", "ent-prefab-variants"]
  },
  {
    id: "ent-prefab-variants",
    parent: "lif-prefabs",
    order: 4,
    title: "Prefab Variants",
    code: "ENT-05D",
    tagline: "A prefab that is-a prefab: the freighter is a spaceship with more cargo",
    intro: "Prefabs can inherit from each other. A <em>variant</em> is a prefab with an <code>IsA</code> pair to another prefab: it keeps everything the base defines and changes only what makes it different. Instances of the variant get the most specific value for each component.",
    sections: [
      {
        type: "text",
        heading: "One template, many flavors",
        html: "<p>You have a SpaceShip prefab. Now you need a Freighter (tougher, slower) and an Interceptor (fragile, fast). Copying the whole SpaceShip definition twice means every later change has to be made three times.</p><p>Instead, make each one a prefab that inherits from SpaceShip and set only the components that differ. A variant is nothing special — it is a prefab with an <code>IsA</code> pair, exactly the same mechanism that turns a prefab into an instance. The difference is only that a variant keeps the <code>Prefab</code> tag, so queries still skip it.</p>"
      },
      {
        type: "code",
        heading: "A base and a variant",
        lang: "c",
        title: "Freighter changes Health, inherits Defense",
        src: "ecs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\necs_set(world, SpaceShip, Defense, {50});\necs_set(world, SpaceShip, Health, {100});\n\necs_entity_t Freighter = ecs_entity(world, {\n    .name = \"Freighter\",\n    .add = ecs_ids( EcsPrefab, ecs_isa(SpaceShip) )\n});\necs_set(world, Freighter, Health, {150});\n\necs_entity_t inst = ecs_new_w_pair(world, EcsIsA, Freighter);\n\nconst Health *h = ecs_get(world, inst, Health);\nconst Defense *d = ecs_get(world, inst, Defense);"
      },
      {
        type: "diagram",
        heading: "Looking up a value walks the chain",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "i", label: "Instance", sub: "owns nothing yet" } ],
            [ { id: "v", label: "Freighter", sub: "Health 150" } ],
            [ { id: "b", label: "SpaceShip", sub: "Health 100, Defense 50" } ]
          ],
          edges: [
            { from: "i", to: "v", label: "IsA" },
            { from: "v", to: "b", label: "IsA" }
          ],
          note: "Health stops at the Freighter (150). Defense is not found there, so the search continues to SpaceShip (50)."
        }
      },
      {
        type: "text",
        heading: "The rules of the chain",
        html: "<ul><li><strong>Nearest wins.</strong> A lookup follows <code>IsA</code> upwards and takes the first value it finds, so a variant shadows its base, and an instance's own override shadows both.</li><li><strong>Depth is free at runtime.</strong> Inherited component lookups are resolved through cached references on the table, not by walking the chain on every <code>get</code>.</li><li><strong>Variants can have variants.</strong> A HeavyFreighter that is-a Freighter that is-a SpaceShip works exactly as you would expect.</li><li><strong>Instantiation composes.</strong> Instantiating a variant applies the base's children, slots and auto overrides too, so a variant of a prefab hierarchy still gets the whole hierarchy.</li><li><strong>It is still one relationship.</strong> Anything that works on <code>IsA</code> works here: querying for <code>(IsA, SpaceShip)</code> finds the variants, and <code>ecs_get_target_for</code> tells you which entity a value was inherited from.</li></ul>"
      }
    ],
    related: ["lif-inheritance", "ent-overriding", "lif-prefab-hierarchies", "cmp-graph-traits"]
  }
]);
