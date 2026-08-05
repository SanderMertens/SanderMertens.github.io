window.FLECS_TOUR.register([
  {
    id: "wld-lifecycle",
    parent: "world",
    order: 1,
    title: "World Lifecycle",
    code: "WLD-01",
    tagline: "Big bang to heat death, in four function calls",
    intro: "A world is born with <code>ecs_init()</code> and dies with <code>ecs_fini()</code>. Everything in between — every entity you create, every query you run — happens inside that one object. Think of it as opening and closing a save file: while it's open you can change anything in it; when you close it, everything inside is cleaned up for you.",
    sections: [
      {
        type: "text",
        heading: "Three ways to start",
        html: "<p>Flecs gives you three constructors, all returning an <code>ecs_world_t*</code>:</p><ul><li><code>ecs_init()</code> — the normal one. It creates the world <em>and</em> imports the modules of every addon Flecs was built with (systems, pipeline, reflection...).</li><li><code>ecs_mini()</code> — just the core. No addon modules are imported, which makes startup faster and the world smaller. Good for tools, tests, or when you only need entities and queries.</li><li><code>ecs_init_w_args(argc, argv)</code> — same as <code>ecs_init()</code>, but it also uses the command line, for example to derive your application's name from <code>argv[0]</code>.</li></ul>"
      },
      {
        type: "diagram",
        heading: "A world's life",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "l1", label: "ecs_init()", sub: "world is created" } ],
            [ { id: "l2", label: "Setup", sub: "register components, systems" } ],
            [ { id: "l3", label: "Main loop", sub: "ecs_progress() each frame" } ],
            [ { id: "l4", label: "ecs_quit()", sub: "asks the loop to stop" },
              { id: "l5", label: "ecs_fini()", sub: "everything is destroyed" } ]
          ],
          edges: [
            { from: "l1", to: "l2" },
            { from: "l2", to: "l3" },
            { from: "l3", to: "l4", label: "signal" },
            { from: "l4", to: "l5" }
          ],
          note: "ecs_quit() only raises a flag; ecs_progress() returns false so your loop can exit and call ecs_fini()."
        }
      },
      {
        type: "code",
        heading: "The skeleton of every Flecs app",
        lang: "c",
        src: "ecs_world_t *world = ecs_init();\n\nwhile (ecs_progress(world, 0)) {\n  if (player_pressed_escape) {\n    ecs_quit(world);\n  }\n}\n\nreturn ecs_fini(world);"
      },
      {
        type: "text",
        heading: "Shutting down, in order",
        html: "<p>Quitting and destroying are two separate ideas:</p><ul><li><code>ecs_quit(world)</code> signals &quot;we're done&quot;. It doesn't destroy anything — it just makes <code>ecs_progress()</code> return false so your main loop can wind down gracefully. <code>ecs_should_quit(world)</code> lets you check the flag yourself.</li><li><code>ecs_fini(world)</code> actually tears the world down: it deletes all root entities first (so cleanup rules like &quot;delete my children with me&quot; get a chance to run), then destroys the internal machinery.</li></ul><p>If your module or plugin needs to clean something up before the lights go out, register a callback with <code>ecs_atfini(world, action, ctx)</code> — Flecs calls it during <code>ecs_fini()</code>. And inside hooks or observers you can ask <code>ecs_is_fini(world)</code> to find out whether you're being called because the world is currently being deleted.</p>"
      }
    ],
    related: ["wld-boot", "wld-flags", "systems"]
  },
  {
    id: "wld-boot",
    parent: "wld-lifecycle",
    order: 1,
    title: "What Boots With the World",
    code: "WLD-01A",
    tagline: "A fresh world is not an empty world",
    intro: "The moment <code>ecs_init()</code> returns, the world already contains dozens of entities: the built-in components, tags, relationships and events that Flecs itself is made of. This is the <em>bootstrap</em>: Flecs uses its own ECS to describe itself, like a dictionary that contains the definitions of the words used in its own definitions.",
    sections: [
      {
        type: "text",
        heading: "The flecs module",
        html: "<p>All built-in entities live under a module entity named <code>flecs</code>, with the core in <code>flecs.core</code>. That's where you'll find old friends from the rest of this tour: the <code>Component</code> and <code>Identifier</code> components, tags like <code>Wildcard</code> (<code>*</code>) and <code>Any</code> (<code>_</code>), relationships like <code>ChildOf</code> and <code>IsA</code>, events like <code>OnAdd</code> and <code>OnRemove</code>, and traits like <code>Transitive</code> and <code>Exclusive</code>.</p><p>Because they're normal entities, you can look them up by path like anything else — <code>ecs_lookup(world, \"flecs.core.ChildOf\")</code> works. The <code>flecs</code> module protects itself with an <code>(OnDelete, Panic)</code> rule: trying to delete it is a hard error, because the world can't function without it.</p>"
      },
      {
        type: "diagram",
        heading: "How the id space is carved up",
        spec: {
          type: "grid",
          title: "Reserved entity id ranges (default build)",
          cols: ["Range", "Who lives here", "Why"],
          rows: [
            ["1 .. 8", "Built-in components", "Component, Identifier, Poly, Parent..."],
            ["9 .. 256", "Your components (low ids)", "ids below FLECS_HI_COMPONENT_ID get a fast lookup path"],
            ["257 .. 384", "Built-in entities", "ChildOf, Wildcard, OnAdd, traits, phases..."],
            ["385 and up", "Your entities", "everything ecs_new() hands out"]
          ],
          note: "FLECS_HI_COMPONENT_ID is 256 by default. ecs_new_low_id() asks for an id from the fast low range."
        }
      },
      {
        type: "text",
        heading: "Why low ids are special",
        html: "<p>For ids below <code>FLECS_HI_COMPONENT_ID</code>, Flecs can use a plain array lookup instead of a hash lookup in several hot code paths. That's why component registration prefers low ids: components are the ids you look up millions of times per frame. You can ask for one yourself with <code>ecs_new_low_id()</code>, or by setting <code>use_low_id</code> when creating an entity with <code>ecs_entity_init()</code>. Low ids are never recycled, and running out of them is fine — Flecs just continues with normal ids.</p><p>One more boot-time detail: the bootstrap calls <code>ecs_set_name_prefix(world, \"Ecs\")</code>, which is why the C type <code>EcsComponent</code> shows up with the friendlier entity name <code>Component</code>.</p>"
      }
    ],
    related: ["wld-entity-ids", "components", "wld-names"]
  },
  {
    id: "wld-flags",
    parent: "wld-lifecycle",
    order: 2,
    title: "World Flags & Modes",
    code: "WLD-01B",
    tagline: "The mode lights on the world's dashboard",
    intro: "The world keeps a small set of on/off flags that describe what state it's in right now: is it starting up? shutting down? locked for reading while systems run? You can read them with <code>ecs_world_get_flags()</code>, and a few of them explain behavior you'll definitely run into.",
    sections: [
      {
        type: "text",
        heading: "The flags that matter",
        html: "<p>Each flag is a single bit in a 32-bit number:</p><ul><li><code>EcsWorldInit</code> — set while the world is still being constructed.</li><li><code>EcsWorldReadonly</code> — the world is locked. Set while multithreaded systems are running, so no one can restructure tables under another thread's feet. Your add/remove/set calls still work — they're quietly recorded in a command queue and replayed when the lock lifts. Readonly mode is a stricter cousin of deferred mode: it also forbids creating systems and queries.</li><li><code>EcsWorldQuit</code> — <code>ecs_quit()</code> was called; <code>ecs_progress()</code> will return false.</li><li><code>EcsWorldFini</code> — <code>ecs_fini()</code> is in progress. This is what <code>ecs_is_fini()</code> checks.</li><li><code>EcsWorldMultiThreaded</code> — systems are being run by worker threads this frame.</li><li><code>EcsWorldFrameInProgress</code> — we're between frame begin and frame end.</li><li><code>EcsWorldMeasureFrameTime</code> / <code>EcsWorldMeasureSystemTime</code> — timing instrumentation is switched on, typically for the stats addon.</li><li><code>EcsWorldQuitWorkers</code> — the worker threads are being told to shut down.</li></ul>"
      },
      {
        type: "diagram",
        heading: "One frame, seen through the flags",
        spec: {
          type: "stack",
          layers: [
            { label: "Frame begins", sub: "EcsWorldFrameInProgress set" },
            { label: "Systems run", sub: "EcsWorldReadonly set; changes go to the command queue" },
            { label: "Merge", sub: "readonly lifts; queued commands are replayed" },
            { label: "Frame ends", sub: "EcsWorldFrameInProgress cleared" }
          ],
          note: "The deferring machinery behind this has its own pages in the Prefabs & Lifecycle deck."
        }
      }
    ],
    related: ["wld-lifecycle", "lifecycle", "systems"]
  },
  {
    id: "wld-entities",
    parent: "world",
    order: 2,
    title: "Creating & Deleting Entities",
    code: "WLD-02",
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
    related: ["wld-liveness", "wld-entity-ids", "lifecycle"]
  },
  {
    id: "wld-liveness",
    parent: "wld-entities",
    order: 1,
    title: "Entity Liveness",
    code: "WLD-02A",
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
    related: ["wld-generations", "wld-entity-ids"]
  },
  {
    id: "wld-entity-ids",
    parent: "wld-entities",
    order: 2,
    title: "Anatomy of an Entity Id",
    code: "WLD-02B",
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
    related: ["wld-generations", "wld-liveness", "components"]
  },
  {
    id: "wld-generations",
    parent: "wld-entity-ids",
    order: 1,
    title: "Generations",
    code: "WLD-02B1",
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
    related: ["wld-liveness", "wld-entity-ids", "wld-ranges"]
  },
  {
    id: "wld-names",
    parent: "world",
    order: 3,
    title: "Names & Paths",
    code: "WLD-03",
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
    related: ["wld-symbols-aliases", "wld-lookups", "wld-hierarchies"]
  },
  {
    id: "wld-symbols-aliases",
    parent: "wld-names",
    order: 1,
    title: "Symbols & Aliases",
    code: "WLD-03A",
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
    code: "WLD-03B",
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
    parent: "world",
    order: 4,
    title: "Hierarchies",
    code: "WLD-04",
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
    related: ["wld-scopes", "wld-names", "components", "queries"]
  },
  {
    id: "wld-scopes",
    parent: "wld-hierarchies",
    order: 1,
    title: "Scopes",
    code: "WLD-04A",
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
    related: ["wld-hierarchies", "wld-lookups", "systems"]
  },
  {
    id: "wld-ranges",
    parent: "world",
    order: 5,
    title: "Entity Ranges",
    code: "WLD-05",
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
    related: ["wld-entity-ids", "wld-liveness", "remote"]
  },
  {
    id: "wld-singletons",
    parent: "world",
    order: 6,
    title: "Singletons",
    code: "WLD-06",
    tagline: "World-wide data, stored with a wink",
    intro: "Some data exists exactly once per world: gravity, the current game time, the input state. A <em>singleton</em> is Flecs' way of storing it — and the trick is delightfully simple: since a component is itself an entity, the component is added <em>to its own entity</em>. Gravity has Gravity.",
    sections: [
      {
        type: "text",
        heading: "The trick, spelled out",
        html: "<p>There is no special singleton storage in the world. When you set the Gravity singleton, Flecs adds the <code>Gravity</code> component to the entity that <em>represents</em> the Gravity component. One entity, wearing its own hat. That means singletons inherit everything components already have — reflection, serialization, observers, queries — with zero extra machinery.</p><p>You can mark a component with the <code>Singleton</code> trait (<code>ecs_add_id(world, ecs_id(Gravity), EcsSingleton)</code>), which enforces that it may only ever be added to itself. Queries then know where to find it: a term for a singleton component is matched on the component itself, so a system can mix per-entity components and singletons in one query.</p>"
      },
      {
        type: "code",
        heading: "Singletons in practice",
        lang: "c",
        src: "typedef struct { float value; } Gravity;\n\nECS_COMPONENT(world, Gravity);\necs_add_id(world, ecs_id(Gravity), EcsSingleton);\n\necs_singleton_set(world, Gravity, { 9.81 });\n\nconst Gravity *g = ecs_singleton_get(world, Gravity);\n\nGravity *gm = ecs_singleton_ensure(world, Gravity);\ngm->value = 3.7;\necs_singleton_modified(world, Gravity);"
      },
      {
        type: "text",
        heading: "Just sugar",
        html: "<p>Every <code>ecs_singleton_*</code> macro expands to a regular entity operation with the component's own id as the entity:</p><ul><li><code>ecs_singleton_set(world, Gravity, {...})</code> is <code>ecs_set(world, ecs_id(Gravity), Gravity, {...})</code>.</li><li><code>ecs_singleton_get</code> is <code>ecs_get</code> on the same entity; <code>ecs_singleton_add</code>, <code>ecs_singleton_remove</code>, <code>ecs_singleton_ensure</code>, <code>ecs_singleton_emplace</code> and <code>ecs_singleton_modified</code> follow the same pattern.</li></ul><p>Use singletons for genuinely world-global state that systems need as context. If you catch yourself wanting two of something, it was never a singleton — give it its own entity.</p>"
      }
    ],
    related: ["components", "wld-boot", "queries"]
  }
]);
