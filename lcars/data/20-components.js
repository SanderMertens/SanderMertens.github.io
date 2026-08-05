window.FLECS_TOUR.register([
  {
    id: "cmp-components",
    parent: "components",
    order: 1,
    title: "Components",
    code: "CMP-01",
    tagline: "Sticky notes with data that you attach to entities",
    intro: "A component is anything you can attach to an entity: a struct with data (<code>Position {10, 20}</code>), a plain label (<code>Npc</code>), or a link to another entity (<code>(Likes, Alice)</code>). An entity is nothing but the sum of what you've attached to it — components are where all the actual information lives.",
    sections: [
      {
        type: "diagram",
        heading: "The four kinds of things you can add",
        spec: {
          type: "grid",
          title: "Flecs vocabulary for attachable things",
          cols: ["Kind", "Carries data", "Is a pair", "Example"],
          rows: [
            ["Tag", "no", "no", "Npc"],
            ["Component", "yes", "no", "Position {10, 20}"],
            ["Relationship", "no", "yes", "(Likes, Alice)"],
            ["Relationship component", "yes", "yes", "(Eats, {amount: 2}, Apples)"]
          ],
          note: "All four are stored and queried the same way; the only differences are whether they carry bytes and whether they point at another entity."
        }
      },
      {
        type: "text",
        heading: "The operations you'll use every day",
        html: "<p>Once a component is registered, a small family of operations covers almost everything:</p><ul><li><strong>add</strong> / <strong>remove</strong> — attach or detach the component. Adding something the entity already has does nothing.</li><li><strong>get</strong> — read the value (returns <code>NULL</code> if the entity doesn't have it). <strong>get_mut</strong> is the writable version.</li><li><strong>set</strong> — write a value, adding the component first if needed, and announce the change so observers and change detection notice it.</li><li><strong>ensure</strong> — like <code>add</code> + <code>get_mut</code>: gives you a writable pointer, creating the component if it wasn't there.</li><li><strong>emplace</strong> — hands you raw, unconstructed memory to fill in yourself, for types that can't be default-created.</li><li><strong>modified</strong> — announce &quot;I changed this&quot; after writing through a mutable pointer, so <code>on_set</code> hooks and observers still fire.</li><li><strong>assign</strong> — like <code>set</code>, but requires that the component already exists.</li></ul>"
      },
      {
        type: "text",
        heading: "What's in this section",
        html: "<p>The pages below cover how components come to exist (registration), the surprising fact that every component is itself an entity, and singletons — components with exactly one instance in the whole world.</p>"
      }
    ],
    related: ["cmp-tags", "cmp-pairs", "storage"]
  },
  {
    id: "cmp-registration",
    parent: "cmp-components",
    order: 1,
    title: "Registering Components",
    code: "CMP-01A",
    tagline: "Telling Flecs your struct exists and how big it is",
    intro: "Before you can attach a <code>Position</code> to anything, Flecs needs to know two things about it: how many bytes it takes (<em>size</em>) and how its address must line up in memory (<em>alignment</em> — some CPUs require an 8-byte number to start at an address divisible by 8). Registration hands Flecs that information once, and gives you back an entity that represents the component from then on.",
    sections: [
      {
        type: "code",
        heading: "The easy way",
        lang: "c",
        title: "ECS_COMPONENT figures out size and alignment for you",
        src: "typedef struct {\n  float x, y;\n} Position;\n\nECS_COMPONENT(world, Position);\n\necs_entity_t e = ecs_new_w(world, Position);"
      },
      {
        type: "text",
        heading: "Using a component across files",
        html: "<p><code>ECS_COMPONENT</code> declares a hidden variable that holds the component's entity id, so it only works inside one function. To use a component across functions or files, split the declaration in two:</p><ul><li><code>ECS_COMPONENT_DECLARE(Position)</code> — declares the id variable (put <code>extern ECS_COMPONENT_DECLARE(Position)</code> in a header, the plain version in one <code>.c</code> file).</li><li><code>ECS_COMPONENT_DEFINE(world, Position)</code> — does the actual registration, filling in that variable.</li></ul><p>Larger projects usually group these into <em>modules</em> that register many components in one import function.</p>"
      },
      {
        type: "diagram",
        heading: "What registration actually does",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "r1", label: "ECS_COMPONENT", sub: "(world, Position)" } ],
            [ { id: "r2", label: "ecs_component_init", sub: "reads an ecs_component_desc_t" } ],
            [ { id: "r3", label: "Component entity", sub: "named \"Position\"" },
              { id: "r4", label: "EcsComponent", sub: "{size: 8, alignment: 4}" } ]
          ],
          edges: [
            { from: "r1", to: "r2" },
            { from: "r2", to: "r3", label: "creates" },
            { from: "r3", to: "r4", label: "gets" }
          ],
          note: "The result is a regular entity carrying an EcsComponent value — that value is what makes it usable as a component."
        }
      },
      {
        type: "struct",
        heading: "The registration form",
        name: "ecs_component_desc_t",
        summary: "What you fill in when calling ecs_component_init() (or the ecs_component() shorthand) to register a component by hand.",
        members: [
          { name: "_canary", type: "int32_t", desc: "A guard value used to catch accidentally passing garbage instead of a properly zeroed struct. Leave it 0." },
          { name: "entity", type: "ecs_entity_t", desc: "An existing entity to turn into the component (optional). Handy for giving the component a name first, or re-registering after a world reset. If left 0, Flecs creates a fresh entity." },
          { name: "type", type: "ecs_type_info_t", desc: "The description of the actual C type: its size, alignment, and optionally its lifecycle hooks. This is the part that says what the bytes look like." }
        ]
      },
      {
        type: "struct",
        heading: "The type description",
        name: "ecs_type_info_t",
        summary: "Everything Flecs knows about a C type. You fill in size and alignment (and maybe hooks); Flecs fills in the rest.",
        members: [
          { name: "size", type: "ecs_size_t", desc: "How many bytes one value of this type occupies. A size of 0 means the id is a tag with no data." },
          { name: "alignment", type: "ecs_size_t", desc: "The address boundary values must start on. For a struct of two floats this is 4; getting it wrong causes crashes on strict CPUs." },
          { name: "hooks", type: "ecs_type_hooks_t", desc: "Optional lifecycle callbacks: constructor, destructor, copy, move, and the on_add/on_set/on_remove callbacks. See the Component Hooks page." },
          { name: "component", type: "ecs_entity_t", desc: "The entity handle of the component this type info belongs to. Filled in by Flecs — don't set it." },
          { name: "name", type: "const char *", desc: "The type's name, used in error messages and logs." },
          { name: "refcount", type: "int32_t", desc: "Internal bookkeeping that tracks how many parts of the storage still use this type info. Don't set it." }
        ]
      },
      {
        type: "code",
        heading: "Registering at runtime",
        lang: "c",
        title: "For types that don't exist at compile time (scripting, editors)",
        src: "ecs_entity_t comp = ecs_component(world, {\n  .entity = ecs_entity(world, { .name = \"MyComponent\" }),\n  .type = {\n    .size = 8,\n    .alignment = 8\n  }\n});\n\necs_entity_t e = ecs_new(world);\necs_add_id(world, e, comp);\nconst void *ptr = ecs_get_id(world, e, comp);"
      }
    ],
    related: ["cmp-component-entities", "reflection"]
  },
  {
    id: "cmp-component-entities",
    parent: "cmp-components",
    order: 2,
    title: "Components Are Entities",
    code: "CMP-01B",
    tagline: "The component describing your data is itself a thing in the world",
    intro: "In Flecs, every component is represented by an entity. When you register <code>Position</code>, an entity named &quot;Position&quot; appears in the world, and it carries a small component called <code>EcsComponent</code> that records the size and alignment of your struct. This one idea — components are entities — powers half of what makes Flecs special.",
    sections: [
      {
        type: "text",
        heading: "Why this is a big deal",
        html: "<p>Because a component is an entity, everything that works on entities works on components too:</p><ul><li>They have <strong>names</strong>, so tools can display them and scripts can look them up.</li><li>They can live in <strong>hierarchies</strong> (modules are just parent entities).</li><li>You can <strong>attach things to them</strong> — and that is exactly how traits work: adding the <code>Sparse</code> tag to the <code>Position</code> entity changes how Position is stored.</li><li>They can be <strong>queried, serialized and inspected</strong> like anything else.</li></ul><p>The rule that separates a component from a tag is simple: an entity that has <code>EcsComponent</code> with a non-zero size is a component; an entity without it (or with size 0) is a tag.</p>"
      },
      {
        type: "code",
        heading: "Meet your component's entity",
        lang: "c",
        src: "ECS_COMPONENT(world, Position);\n\necs_entity_t pos = ecs_id(Position);\n\nconst EcsComponent *c = ecs_get(world, pos, EcsComponent);\nprintf(\"{size: %d, alignment: %d}\\n\", c->size, c->alignment);\n\necs_add_id(world, pos, EcsSparse);"
      },
      {
        type: "struct",
        heading: "The component component",
        name: "EcsComponent",
        summary: "The tiny builtin component that turns an entity into a component. If an entity has this, ids of that entity can carry data.",
        members: [
          { name: "size", type: "ecs_size_t", desc: "How many bytes one value takes. This is what the storage uses to size table columns." },
          { name: "alignment", type: "ecs_size_t", desc: "The memory boundary values must start on, so the CPU can read them without tripping." }
        ]
      },
      {
        type: "text",
        heading: "Unregistering",
        html: "<p>Deleting the component entity unregisters the component: by default it is removed from every entity that has it, and the tables that stored it are cleaned up. What exactly happens on deletion is governed by cleanup traits — see the Cleanup Traits page and the Prefabs &amp; Lifecycle deck.</p>"
      }
    ],
    related: ["cmp-traits", "cmp-cleanup-traits", "world"]
  },
  {
    id: "cmp-singletons",
    parent: "cmp-components",
    order: 3,
    title: "Singletons",
    code: "CMP-01C",
    tagline: "Data that exists exactly once in the whole world",
    intro: "Some data isn't <em>about</em> any particular entity: the time of day, the game's score, a handle to the physics engine. A singleton is a component with exactly one instance, which you read and write on the world directly without naming an entity.",
    sections: [
      {
        type: "code",
        heading: "Using a singleton",
        lang: "c",
        src: "typedef struct {\n  float value;\n} TimeOfDay;\n\nECS_COMPONENT(world, TimeOfDay);\n\necs_singleton_set(world, TimeOfDay, { 0.5 });\n\nconst TimeOfDay *t = ecs_singleton_get(world, TimeOfDay);"
      },
      {
        type: "text",
        heading: "The trick: a component added to itself",
        html: "<p>There is no separate singleton storage. Since every component is an entity, Flecs simply stores the singleton value <em>on the component's own entity</em>: <code>ecs_singleton_set(world, TimeOfDay, ...)</code> is exactly <code>ecs_set(world, ecs_id(TimeOfDay), TimeOfDay, ...)</code>.</p><p>This reuses all the normal machinery — queries, observers, serialization all just work — and it naturally spreads singletons across entities instead of piling them onto one, which is good for performance.</p>"
      },
      {
        type: "text",
        heading: "The Singleton trait",
        html: "<p>Adding the <code>Singleton</code> trait to a component enforces the pattern: the component can then only be added to its own entity, and adding it anywhere else panics. It also teaches queries about it — a query term for a <code>Singleton</code> component automatically reads from the component entity, so a system can mix per-entity terms like <code>Position</code> with a singleton term like <code>TimeOfDay</code> in one query.</p><p>This trait is part of the constraint traits addon (<code>FLECS_CONSTRAINT_TRAITS</code>), which is included by default.</p>"
      }
    ],
    related: ["cmp-component-entities", "queries"]
  },
  {
    id: "cmp-tags",
    parent: "components",
    order: 2,
    title: "Tags",
    code: "CMP-02",
    tagline: "Labels with no data — cheap and everywhere",
    intro: "A tag is a component that carries no data: it just marks an entity as something. <code>Npc</code>, <code>Frozen</code>, <code>Enemy</code> — you can't ask for a tag's <em>value</em>, only whether an entity has it. Tags are the cheapest thing you can add, and Flecs itself uses them everywhere.",
    sections: [
      {
        type: "code",
        heading: "Two ways to make a tag",
        lang: "c",
        title: "A dedicated macro, or literally any entity",
        src: "ECS_TAG(world, Npc);\n\necs_entity_t Enemy = ecs_entity(world, { .name = \"Enemy\" });\n\necs_entity_t e = ecs_new(world);\necs_add(world, e, Npc);\necs_add_id(world, e, Enemy);\n\nif (ecs_has(world, e, Npc)) {\n  printf(\"e is an npc\\n\");\n}"
      },
      {
        type: "text",
        heading: "Why tags are so cheap",
        html: "<p>The storage sorts entities into <em>tables</em> — groups of entities with the exact same set of components, one memory column per data-carrying component. A tag has no data, so it adds <strong>no column</strong>: it only changes which table the entity sits in. Checking for a tag, or querying for all entities with a tag, costs the same as for any component, but there are no bytes to store, copy or move around.</p><p>Note the definition: a tag is any id <em>not associated with a type</em>. A regular entity like <code>Enemy</code> above works as a tag simply because it has no <code>EcsComponent</code>. This is also why relationship targets can be plain entities.</p>"
      },
      {
        type: "text",
        heading: "Gotchas",
        html: "<ul><li><strong>Tags can't have hooks.</strong> Lifecycle hooks only exist for types with a size. If you need callbacks on a tag, give it a dummy member or use an observer instead.</li><li><strong>Deleting a tag entity removes the tag everywhere.</strong> Because the tag is an entity, deleting it triggers cleanup on every entity that has it — usually what you want, and configurable with cleanup traits.</li><li><strong>Empty C++ structs become tags automatically</strong>; in C, zero-size registration does the same.</li></ul>"
      }
    ],
    related: ["cmp-pairs", "cmp-registration", "storage"]
  },
  {
    id: "cmp-pairs",
    parent: "components",
    order: 3,
    title: "Relationships & Pairs",
    code: "CMP-03",
    tagline: "Bob likes Alice — links between entities as first-class data",
    intro: "A relationship lets you attach not just data to an entity, but a <em>link to another entity</em>. &quot;Bob <em>likes</em> Alice&quot;, &quot;this turret is a <em>child of</em> the spaceship&quot;. The combination of a relationship and its target — written <code>(Likes, Alice)</code> — is called a <em>pair</em>, and you add it to an entity exactly like a component.",
    sections: [
      {
        type: "code",
        heading: "Bob likes Alice",
        lang: "c",
        src: "ecs_entity_t Likes = ecs_new(world);\necs_entity_t Bob = ecs_new(world);\necs_entity_t Alice = ecs_new(world);\n\necs_add_pair(world, Bob, Likes, Alice);\n\necs_has_pair(world, Bob, Likes, Alice);\n\necs_remove_pair(world, Bob, Likes, Alice);"
      },
      {
        type: "text",
        heading: "The vocabulary",
        html: "<p>In <code>Bob — (Likes, Alice)</code>:</p><ul><li><strong>Bob</strong> is the <em>source</em>: the entity the pair is added to.</li><li><strong>Likes</strong> is the <em>relationship</em>: the first element of the pair.</li><li><strong>Alice</strong> is the <em>target</em>: the second element.</li></ul><p>The same relationship can be added many times with different targets — Bob can have both <code>(Eats, Apples)</code> and <code>(Eats, Pears)</code>. That breaks the usual &quot;one of each component&quot; rule in a controlled way, and is also a trick for attaching the same component type twice.</p>"
      },
      {
        type: "text",
        heading: "Querying over relationships",
        html: "<p>Queries treat pairs like any other component, and add wildcards on top: <code>(Eats, Apples)</code> matches everyone eating apples; <code>(Eats, *)</code> matches everyone eating <em>anything</em>. Queries can even chain pairs into graph searches (&quot;everything located in something located in USA&quot;) — that story continues in the Queries deck.</p>"
      },
      {
        type: "text",
        heading: "Builtin relationships",
        html: "<p>Flecs ships three relationships with special meaning:</p><ul><li><code>ChildOf</code> — parent-child hierarchies. It is <em>exclusive</em>: adding <code>(ChildOf, parent_b)</code> replaces <code>(ChildOf, parent_a)</code>, because nothing has two parents.</li><li><code>IsA</code> — inheritance: &quot;this entity is an instance of that prefab&quot;.</li><li><code>DependsOn</code> — used by systems to declare execution order.</li></ul><p>All three are ordinary relationship entities that happen to carry the right traits — you can build your own with the same powers.</p>"
      }
    ],
    related: ["cmp-pair-ids", "cmp-graph-traits", "queries", "lifecycle"]
  },
  {
    id: "cmp-pair-ids",
    parent: "cmp-pairs",
    order: 1,
    title: "How Pairs Fit In One Id",
    code: "CMP-03A",
    tagline: "Two entities squeezed into a single 64-bit number",
    intro: "To the storage engine, a pair is not a special object — it's just another id, like a component id. The trick is bit-packing: <code>ecs_pair(Likes, Alice)</code> folds both entity ids into one 64-bit number, so everything built for single ids (tables, indexes, queries) works on pairs for free.",
    sections: [
      {
        type: "diagram",
        heading: "Anatomy of an id",
        spec: {
          type: "grid",
          title: "The 64 bits of an ecs_id_t",
          cols: ["", "bits 63-60", "bits 59-32", "bits 31-0"],
          rows: [
            ["Plain entity id", "id flags (unused)", "generation counter (16 bits used)", "entity number"],
            ["Pair id", "PAIR flag set", "first element: Likes", "second element: Alice"]
          ],
          note: "A pair sets the PAIR flag bit and stores the relationship in the high half, the target in the low half. Generation bits are stripped from both when packing."
        }
      },
      {
        type: "code",
        heading: "It's all ecs_add_id underneath",
        lang: "c",
        title: "Component adds and pair adds converge on the same call",
        src: "ecs_add(world, e, Position);\necs_add_id(world, e, ecs_id(Position));\n\necs_add_pair(world, e, Likes, Apples);\necs_add_id(world, e, ecs_pair(Likes, Apples));\n\necs_id_t pair = ecs_pair(Likes, Apples);\necs_entity_t rel = ecs_pair_first(world, pair);\necs_entity_t tgt = ecs_pair_second(world, pair);"
      },
      {
        type: "text",
        heading: "What the packing costs",
        html: "<p>Because pairs are ordinary ids, adding or removing a pair costs the same as adding or removing a component. A few second-order effects are worth knowing:</p><ul><li><strong>No low-id fast path.</strong> Flecs reserves ids below a threshold (256 by default) for components, and table-graph edges for those use direct array indexing. A packed pair can never be a low id, so pair adds always go through a hash map — typically a 5-10% overhead on the operation.</li><li><strong>More tables.</strong> Every distinct set of components-and-pairs is its own table, so heavy relationship use multiplies tables (<em>fragmentation</em>). Flecs is built to handle hundreds of thousands of tables, and the <code>DontFragment</code> trait exists for extreme cases.</li><li><strong>More index work.</strong> A new table with <code>(Likes, Apples)</code> registers itself under <code>(Likes, Apples)</code>, <code>(Likes, *)</code>, <code>(*, Apples)</code> and <code>(*, *)</code>, making its creation a bit pricier.</li></ul>"
      }
    ],
    related: ["cmp-wildcards", "cmp-sparse", "storage", "internals"]
  },
  {
    id: "cmp-pair-data",
    parent: "cmp-pairs",
    order: 2,
    title: "Pairs With Data",
    code: "CMP-03B",
    tagline: "When (Eats, Apples) carries a number",
    intro: "A pair can hold a value, just like a component — Bob doesn't just eat apples, he eats <em>2</em> of them. Since a pair has two elements, Flecs needs a rule to decide which element's type the value uses.",
    sections: [
      {
        type: "text",
        heading: "The four rules",
        html: "<p>Checked in order, first match wins:</p><ol><li>If neither element is a type (both are tags/plain entities), the pair is a tag — no data.</li><li>If the relationship has the <code>PairIsTag</code> trait, the pair is a tag — no data, ever.</li><li>If the relationship is a type (has a size), the pair holds a value of the <em>relationship's</em> type.</li><li>Otherwise, if the target is a type, the pair holds a value of the <em>target's</em> type.</li></ol>"
      },
      {
        type: "code",
        heading: "The rules in action",
        lang: "c",
        src: "typedef struct { float x, y; } Position;\ntypedef struct { float amount; } Eats;\n\nECS_COMPONENT(world, Position);\nECS_COMPONENT(world, Eats);\n\necs_entity_t Likes = ecs_new(world);\necs_entity_t Begin = ecs_new(world);\necs_entity_t Apples = ecs_new(world);\n\necs_entity_t e = ecs_new(world);\n\necs_add_pair(world, e, Likes, Apples);\n\necs_set_pair(world, e, Eats, Apples, { .amount = 2 });\n\necs_set_pair_second(world, e, Begin, Position, {0, 0});"
      },
      {
        type: "text",
        heading: "Same relationship, many values",
        html: "<p>Because <code>(Eats, Apples)</code> and <code>(Eats, Pears)</code> are different ids, each carries its <em>own</em> <code>Eats</code> value. This is the standard trick for attaching one component type to an entity more than once — something plain components can't do.</p><p>Watch out for rule 4: with a tag relationship like <code>Serializable</code> and a component target like <code>Position</code>, the pair <code>(Serializable, Position)</code> would silently hold a second, unintended <code>Position</code> value. Adding <code>PairIsTag</code> to <code>Serializable</code> switches that off (this is why <code>ChildOf</code> has it — a parent being a component shouldn't give children data).</p>"
      }
    ],
    related: ["cmp-tags", "cmp-guard-traits"]
  },
  {
    id: "cmp-wildcards",
    parent: "cmp-pairs",
    order: 3,
    title: "Wildcards & Targets",
    code: "CMP-03C",
    tagline: "Does Bob like anyone? Who does Bob like?",
    intro: "Wildcards let you ask about pairs without pinning down both halves. <code>(Likes, *)</code> means &quot;likes anything&quot;, <code>(*, Alice)</code> means &quot;anything pointed at Alice&quot;. Alongside them, a small API answers the everyday questions: who is the parent, what are the targets, how many.",
    sections: [
      {
        type: "code",
        heading: "Asking about targets",
        lang: "c",
        src: "ecs_has_pair(world, Bob, Likes, EcsWildcard);\n\necs_entity_t first = ecs_get_target(world, Bob, Likes, 0);\necs_entity_t second = ecs_get_target(world, Bob, Likes, 1);\n\necs_entity_t parent = ecs_get_target(world, Bob, EcsChildOf, 0);\n\necs_query_t *q = ecs_query(world, { .expr = \"(Likes, *)\" });"
      },
      {
        type: "text",
        heading: "Two wildcards, different personalities",
        html: "<p>Flecs has two wildcard entities:</p><ul><li><code>*</code> (<code>EcsWildcard</code>) — match any, return <strong>all</strong> matches. If Bob eats apples and pears, a query for <code>(Eats, *)</code> yields Bob twice, once per target.</li><li><code>_</code> (<code>EcsAny</code>) — match any, return only the <strong>first</strong>. &quot;Does Bob eat at all?&quot; — one result, faster when you don't care which.</li></ul>"
      },
      {
        type: "diagram",
        heading: "How the index finds pairs in a table",
        spec: {
          type: "grid",
          title: "One table's type, slot by slot",
          cols: ["slot 0", "slot 1", "slot 2", "slot 3", "slot 4", "slot 5"],
          rows: [
            ["Npc", "(Likes, Apples)", "(Likes, Pears)", "(Likes, Bananas)", "(Eats, Apples)", "(Eats, Pears)"]
          ],
          note: "Pairs with the same relationship sit next to each other. The (Likes, *) index entry stores column=1, count=3: start at slot 1, read 3 slots. The (*, Pears) entry stores column=2, count=2: scan from slot 2 until 2 matches are found."
        }
      },
      {
        type: "text",
        heading: "Cost asymmetry",
        html: "<p>Because a table's type is sorted by relationship, all <code>(Likes, ...)</code> pairs are contiguous — so <code>(Likes, *)</code> queries jump straight to them. Pairs with the same <em>target</em> are scattered, so <code>(*, Apples)</code> needs a linear scan through the table's type. Both are fine; just prefer relationship-side wildcards in hot paths when you have the choice.</p>"
      }
    ],
    related: ["cmp-pair-ids", "queries"]
  },
  {
    id: "cmp-traits",
    parent: "components",
    order: 4,
    title: "Component Traits",
    code: "CMP-04",
    tagline: "Change how a component behaves by tagging the component itself",
    intro: "Traits are tags and pairs that you add to a <em>component's entity</em> to change how that component behaves — how it's stored, what queries infer from it, what happens when things are deleted, and what the API allows. Since components are entities, this needs no special mechanism: configuring a component is just adding things to it.",
    sections: [
      {
        type: "code",
        heading: "The pattern",
        lang: "c",
        title: "Every trait is applied the same way",
        src: "ECS_COMPONENT(world, Position);\necs_add_id(world, ecs_id(Position), EcsSparse);\n\necs_entity_t LocatedIn = ecs_new(world);\necs_add_id(world, LocatedIn, EcsTransitive);\n\necs_add_pair(world, ecs_id(Position), EcsOnInstantiate, EcsInherit);"
      },
      {
        type: "text",
        heading: "A field guide to the traits",
        html: "<p>The trait pages group them by what they affect:</p><ul><li><strong>Graph traits</strong> — how queries walk relationship graphs: <code>Transitive</code>, <code>Reflexive</code>, <code>Symmetric</code>, <code>Acyclic</code>, <code>Traversable</code>, <code>Exclusive</code>.</li><li><strong>Inheritance traits</strong> — what happens when entities inherit from prefabs: <code>OnInstantiate</code> (with <code>Override</code>/<code>Inherit</code>/<code>DontInherit</code>), <code>Final</code>, <code>Inheritable</code>.</li><li><strong>Cleanup traits</strong> — what happens when a component or target is deleted: <code>OnDelete</code>, <code>OnDeleteTarget</code> with <code>Remove</code>/<code>Delete</code>/<code>Panic</code>.</li><li><strong>Guard-rail traits</strong> — rules the API enforces for you: <code>With</code>, <code>OneOf</code>, <code>Relationship</code>, <code>Target</code>, <code>Trait</code>, <code>PairIsTag</code>, <code>Singleton</code>.</li><li><strong>Storage traits</strong> — where and how the bytes live, covered on their own pages: <code>CanToggle</code> (Enabling &amp; Disabling), <code>Sparse</code> and <code>DontFragment</code> (Sparse &amp; Non-Fragmenting).</li></ul>"
      },
      {
        type: "text",
        heading: "The Trait trait",
        html: "<p>There is even a trait named <code>Trait</code>: adding it to a tag marks that tag as a behavior-modifier. All builtin traits carry it. It's optional for your own traits — its main job is relaxing the <code>Relationship</code> guard-rail, so an entity restricted to relationship use can still receive trait tags.</p><p>Several enforcement traits (<code>Final</code>, <code>Symmetric</code>, <code>Acyclic</code>, <code>OneOf</code>, <code>Trait</code>, <code>Relationship</code>, <code>Target</code>, <code>Singleton</code>) live in the constraint traits addon (<code>FLECS_CONSTRAINT_TRAITS</code>), which is part of the default build.</p>"
      }
    ],
    related: ["cmp-component-entities", "cmp-toggle", "cmp-sparse"]
  },
  {
    id: "cmp-graph-traits",
    parent: "cmp-traits",
    order: 1,
    title: "Graph Traits",
    code: "CMP-04A",
    tagline: "Teach queries the logic of your relationships",
    intro: "Relationships form graphs: chains of <code>LocatedIn</code>, trees of <code>ChildOf</code>, webs of <code>MarriedTo</code>. Graph traits tell Flecs what kind of graph a relationship makes, so queries can reason over it — following chains, assuming symmetry, or refusing cycles.",
    sections: [
      {
        type: "diagram",
        heading: "Transitive: following the chain",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "g1", label: "Manhattan" } ],
            [ { id: "g2", label: "New York" } ],
            [ { id: "g3", label: "USA" } ]
          ],
          edges: [
            { from: "g1", to: "g2", label: "LocatedIn" },
            { from: "g2", to: "g3", label: "LocatedIn" },
            { from: "g1", to: "g3", dashed: true, label: "inferred by queries" }
          ],
          note: "With Transitive on LocatedIn, a query for (LocatedIn, USA) returns both New York and Manhattan — the dashed pair is never stored."
        }
      },
      {
        type: "text",
        heading: "The reasoning traits",
        html: "<ul><li><strong>Transitive</strong> — if R(A, B) and R(B, C), queries treat R(A, C) as true. Perfect for containment and category chains.</li><li><strong>Reflexive</strong> — R(A, A) is always true. &quot;Is a tree a tree?&quot; Yes, even though no <code>(IsA, Tree)</code> is stored on Tree itself. A location is <em>not</em> located in itself, so <code>LocatedIn</code> would stay non-reflexive.</li><li><strong>Symmetric</strong> — adding <code>(MarriedTo, Alice)</code> to Bob automatically adds <code>(MarriedTo, Bob)</code> to Alice, and removal mirrors too. For relationships that only make sense both ways.</li></ul>"
      },
      {
        type: "code",
        heading: "Symmetric and exclusive in action",
        lang: "c",
        src: "ecs_entity_t MarriedTo = ecs_new_w_id(world, EcsSymmetric);\necs_add_id(world, MarriedTo, EcsExclusive);\n\necs_entity_t Bob = ecs_new(world);\necs_entity_t Alice = ecs_new(world);\n\necs_add_pair(world, Bob, MarriedTo, Alice);\n\necs_has_pair(world, Alice, MarriedTo, Bob);"
      },
      {
        type: "text",
        heading: "The structure traits",
        html: "<ul><li><strong>Exclusive</strong> — only one instance of the relationship per entity; adding a second target <em>replaces</em> the first, in a single fast operation. <code>ChildOf</code> is exclusive (one parent), and so is <code>OnDelete</code> itself (one policy).</li><li><strong>Acyclic</strong> — declares the relationship must not form cycles (you can't be located in yourself, however indirectly). Flecs can then flag accidental cycles — though full cycle detection is expensive, so this is a best-effort safety net, not a guarantee.</li><li><strong>Traversable</strong> — allows queries to walk the relationship upwards (the <code>up</code> flag: &quot;match Position on my parent&quot;), and lets events ride along its edges — how a change on a prefab reaches its instances. Traversable relationships are automatically acyclic. <code>ChildOf</code> and <code>IsA</code> both have it.</li></ul>"
      }
    ],
    related: ["cmp-pairs", "queries", "events"]
  },
  {
    id: "cmp-inheritance-traits",
    parent: "cmp-traits",
    order: 2,
    title: "Inheritance Traits",
    code: "CMP-04B",
    tagline: "What each component does when an entity is stamped from a prefab",
    intro: "When you add <code>(IsA, base)</code> to an entity, the entity is <em>instantiated</em> from that base — typically a prefab template. The <code>OnInstantiate</code> trait decides, per component, what happens at that moment: copy the value, share it, or skip it entirely.",
    sections: [
      {
        type: "diagram",
        heading: "Three fates for a component",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "i1", label: "Prefab base", sub: "Mass = {100}" } ],
            [ { id: "i2", label: "Override", sub: "instance gets its own copy" },
              { id: "i3", label: "Inherit", sub: "instance shares the base value" },
              { id: "i4", label: "DontInherit", sub: "instance gets nothing" } ]
          ],
          edges: [
            { from: "i1", to: "i2", label: "default" },
            { from: "i1", to: "i3" },
            { from: "i1", to: "i4" }
          ],
          note: "Set per component with an (OnInstantiate, X) pair on the component entity."
        }
      },
      {
        type: "code",
        heading: "Choosing a policy",
        lang: "c",
        src: "ECS_COMPONENT(world, Mass);\necs_add_pair(world, ecs_id(Mass), EcsOnInstantiate, EcsInherit);\n\necs_entity_t base = ecs_insert(world, ecs_value(Mass, {100}));\necs_entity_t inst = ecs_insert(world, { ecs_isa(base) });\n\nassert(ecs_has(world, inst, Mass));\nassert(!ecs_owns(world, inst, Mass));"
      },
      {
        type: "text",
        heading: "What each policy means",
        html: "<ul><li><strong>Override</strong> (default) — the value is copied to the instance, which then owns its own version. Requires the component to be copyable. Fastest to read afterwards, uses memory per instance.</li><li><strong>Inherit</strong> — the value stays on the base and is stored once; <code>get</code>, <code>has</code> and queries transparently follow the <code>IsA</code> link to find it. Change the base and every instance sees it. Adding the component to an instance manually creates an override on top.</li><li><strong>DontInherit</strong> — the instance neither copies nor sees the component. Right for identity-ish data that must never leak from a template.</li></ul><p>The difference between <code>has</code> and <code>owns</code> matters here: an inheriting instance <em>has</em> Mass, but doesn't <em>own</em> it.</p>"
      },
      {
        type: "text",
        heading: "Final and Inheritable",
        html: "<ul><li><strong>Final</strong> — the entity cannot be used as an <code>IsA</code> target at all; trying is an error. Like a final class. Queries use this as an optimization: no need to look for subclasses of something that can't have any.</li><li><strong>Inheritable</strong> — the opposite promise: this component <em>will</em> be inherited from. Queries decide at creation time whether to do inheritance bookkeeping; marking a component <code>Inheritable</code> guarantees queries created before any <code>IsA</code> pairs exist still account for them. If a query wasn't inheritance-aware and inheritance appears later, iteration fails in debug mode.</li></ul>"
      }
    ],
    related: ["lifecycle", "queries", "cmp-traits"]
  },
  {
    id: "cmp-cleanup-traits",
    parent: "cmp-traits",
    order: 3,
    title: "Cleanup Traits",
    code: "CMP-04C",
    tagline: "No dangling references, and you choose how",
    intro: "When an entity that is used <em>as</em> a tag, component, relationship or target gets deleted, every reference to it in the storage must go too — Flecs never leaves dangling ids behind. Cleanup traits let you pick <em>what</em> happens to the entities holding those references: lose the component, or be deleted along with it.",
    sections: [
      {
        type: "text",
        heading: "Conditions and actions",
        html: "<p>A cleanup policy is a pair on the entity being deleted: <code>(Condition, Action)</code>.</p><p>Two conditions:</p><ul><li><code>OnDelete</code> — fires when the component/tag/relationship itself is deleted.</li><li><code>OnDeleteTarget</code> — fires when an entity used as a <em>target</em> of this relationship is deleted.</li></ul><p>Three actions:</p><ul><li><code>Remove</code> (default) — strip the reference from everything that has it.</li><li><code>Delete</code> — delete every entity that has the reference.</li><li><code>Panic</code> — refuse and raise a fatal error; for references that should never disappear at runtime.</li></ul>"
      },
      {
        type: "code",
        heading: "The classic example: ChildOf",
        lang: "c",
        title: "Delete the parent, delete the children",
        src: "ecs_add_pair(world, EcsChildOf, EcsOnDeleteTarget, EcsDelete);\n\necs_entity_t Likes = ecs_new(world);\necs_add_pair(world, Likes, EcsOnDelete, EcsRemove);\n\necs_entity_t parent = ecs_new(world);\necs_entity_t child = ecs_new_w_pair(world, EcsChildOf, parent);\n\necs_delete(world, parent);\nassert(!ecs_is_alive(world, child));"
      },
      {
        type: "text",
        heading: "Fine print",
        html: "<ul><li>The <code>ChildOf</code> policy above is builtin — shown here only to illustrate the syntax.</li><li>Policies cover ids added <em>to</em> entities, not entity values stored <em>inside</em> your component structs — those you must handle yourself.</li><li>Cleanup guarantees no dangling references, but not a specific ordering of <code>OnRemove</code> callbacks across entities — and during world teardown, ordering rules relax further.</li></ul><p>Cleanup order, world teardown, and how deferred operations interact with deletion get the full treatment in the Prefabs &amp; Lifecycle deck.</p>"
      }
    ],
    related: ["lifecycle", "cmp-component-entities", "events"]
  },
  {
    id: "cmp-guard-traits",
    parent: "cmp-traits",
    order: 4,
    title: "Guard-Rail Traits",
    code: "CMP-04D",
    tagline: "Rules the API enforces so your data can't go wrong",
    intro: "These traits don't change storage or queries — they constrain <em>usage</em>. They let you encode rules like &quot;this always comes with that&quot; or &quot;this may only ever be a target&quot; directly in the data model, so mistakes fail loudly at the add site instead of corrupting state quietly.",
    sections: [
      {
        type: "code",
        heading: "With and OneOf",
        lang: "c",
        title: "Great power implies great responsibility; food targets stay under Food",
        src: "ecs_entity_t Responsibility = ecs_new(world);\necs_entity_t Power = ecs_new_w_pair(world, EcsWith, Responsibility);\n\necs_entity_t e = ecs_new_w_id(world, Power);\nassert(ecs_has_id(world, e, Responsibility));\n\necs_entity_t Food = ecs_new(world);\necs_add_id(world, Food, EcsOneOf);\necs_entity_t Apples = ecs_new_w_pair(world, EcsChildOf, Food);\n\necs_entity_t ok = ecs_new_w_pair(world, Food, Apples);"
      },
      {
        type: "text",
        heading: "The companions",
        html: "<ul><li><strong>With</strong> — <code>(With, Other)</code> on a component means adding it always adds <code>Other</code> too. On a relationship, the companion is added as a pair with the <em>same target</em>: with <code>(With, Likes)</code> on <code>Loves</code>, adding <code>(Loves, Pears)</code> also adds <code>(Likes, Pears)</code>.</li><li><strong>OneOf</strong> — constrains a relationship's targets to children of a given entity: children of the relationship itself (add <code>OneOf</code> as a tag) or of any other entity (add <code>(OneOf, Parent)</code>). Adding a pair with an out-of-family target panics. This is how enum relationships stay honest.</li></ul>"
      },
      {
        type: "text",
        heading: "The role enforcers",
        html: "<ul><li><strong>Relationship</strong> — the entity may only appear as the first element of a pair. <code>ecs_add(world, e, Likes)</code> panics; <code>(Likes, Apples)</code> is fine. Tags with the <code>Trait</code> trait are exempt as pair firsts, so traits can still be applied to it.</li><li><strong>Target</strong> — the mirror image: only allowed as the second element of a pair.</li><li><strong>Trait</strong> — marks a tag as a behavior-modifier (see the Component Traits page).</li><li><strong>PairIsTag</strong> — pairs with this relationship never carry data, even when the target is a component (details on the Pairs With Data page).</li><li><strong>Singleton</strong> — the component may only be added to its own entity (see the Singletons page).</li></ul>"
      }
    ],
    related: ["cmp-pair-data", "cmp-singletons", "cmp-traits"]
  },
  {
    id: "cmp-hooks",
    parent: "components",
    order: 5,
    title: "Component Hooks",
    code: "CMP-05",
    tagline: "Callbacks for every stage of a component's life",
    intro: "Hooks are callbacks that run at fixed points in a component's life: when its memory is created, copied, moved or destroyed, and when it's added to, set on, or removed from an entity. Unlike observers, a type has at most <em>one</em> of each hook, and their timing relative to observers is guaranteed — which makes them the right place for resource management and value validation.",
    sections: [
      {
        type: "diagram",
        heading: "A component's life",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "h1", label: "Added", sub: "ecs_add / ecs_set" } ],
            [ { id: "h2", label: "ctor", sub: "memory becomes valid" },
              { id: "h3", label: "on_add hook", sub: "then OnAdd observers" } ],
            [ { id: "h4", label: "Alive", sub: "on set: on_validate, on_replace, on_set; on table move: move hooks" } ],
            [ { id: "h5", label: "Removed", sub: "OnRemove observers, then on_remove" },
              { id: "h6", label: "dtor", sub: "memory reclaimed" } ]
          ],
          edges: [
            { from: "h1", to: "h2" },
            { from: "h2", to: "h3" },
            { from: "h3", to: "h4" },
            { from: "h4", to: "h5" },
            { from: "h5", to: "h6" }
          ],
          note: "Moving an entity to another table runs the move hooks on the way — the value survives, its address doesn't."
        }
      },
      {
        type: "text",
        heading: "Two families of hooks",
        html: "<p><strong>Type hooks</strong> manage the bytes, like C++ special member functions: <code>ctor</code>, <code>dtor</code>, <code>copy</code>, <code>move</code>, plus combined forms. Use them for resource management — allocating and freeing what the component owns. Flecs synthesizes the combined forms from the basics if you don't provide them, and if you set <code>dtor</code>/<code>copy</code>/<code>move</code> without a <code>ctor</code>, it installs a default constructor that zeroes the memory so the other hooks never see garbage.</p><p><strong>Component hooks</strong> (<code>on_add</code>, <code>on_set</code>, <code>on_remove</code>, <code>on_replace</code>, <code>on_validate</code>) fire on ECS operations and are for application behavior. Their guaranteed ordering is the point: <code>on_add</code> and <code>on_set</code> run <em>before</em> observers (so a hook can patch a value before anyone sees it), <code>on_remove</code> runs <em>after</em> observers but before the destructor.</p><p>Hooks apply to every instance of the type — including pair instances: the <code>ctor</code> of <code>Eats</code> runs when <code>(Eats, Apples)</code> is added. Tags (zero-size) can't have hooks.</p>"
      },
      {
        type: "struct",
        heading: "The hook table",
        name: "ecs_type_hooks_t",
        summary: "All lifecycle callbacks for one type, passed to ecs_set_hooks(). Every member is optional.",
        members: [
          { name: "ctor", type: "ecs_xtor_t", desc: "Runs when a new instance is created, to make the memory a valid value (like a C++ default constructor)." },
          { name: "dtor", type: "ecs_xtor_t", desc: "Runs when an instance is destroyed — free whatever the component owns." },
          { name: "copy", type: "ecs_copy_t", desc: "Copies a value over an existing valid value (copy assignment). Without it, Flecs does a plain byte copy." },
          { name: "move", type: "ecs_move_t", desc: "Moves a value over an existing valid value (move assignment), leaving the source safe to destroy." },
          { name: "copy_ctor", type: "ecs_copy_t", desc: "Copies into unconstructed memory (copy constructor). Synthesized from ctor + copy if not set." },
          { name: "move_ctor", type: "ecs_move_t", desc: "Moves into unconstructed memory (move constructor). Synthesized from ctor + move if not set." },
          { name: "ctor_move_dtor", type: "ecs_move_t", desc: "Construct destination, move into it, destroy source — the combo used when a value moves to a brand new spot, like a table move. Derived from the others if not set." },
          { name: "move_dtor", type: "ecs_move_t", desc: "Move into an existing spot, then destroy the source — the combo used when a removal shuffles the last row into a gap. Derived if not set." },
          { name: "cmp", type: "ecs_cmp_t", desc: "Orders two values: returns -1, 0 or 1. Used for sorting." },
          { name: "equals", type: "ecs_equals_t", desc: "Tests whether two values are equal." },
          { name: "flags", type: "ecs_flags32_t", desc: "Which hooks are set, and which are illegal. Setting an ILLEGAL flag (like ECS_TYPE_HOOK_MOVE_ILLEGAL) installs a hook that panics if called — for types that must never be copied or moved." },
          { name: "on_add", type: "ecs_iter_action_t", desc: "Runs when the component is added to an entity, before OnAdd observers." },
          { name: "on_set", type: "ecs_iter_action_t", desc: "Runs when the component is set, before OnSet observers — the component reacts to its own change first." },
          { name: "on_remove", type: "ecs_iter_action_t", desc: "Runs when the component is removed, after OnRemove observers and before the dtor." },
          { name: "on_replace", type: "ecs_iter_action_t", desc: "Gets both the old and new value just before an assignment, between on_add and on_set. Registering it disables operations that return raw mutable pointers (get_mut, ensure, emplace), since those would bypass it." },
          { name: "on_validate", type: "ecs_on_validate_t", desc: "Called per entity with the new value before on_set and OnSet observers; return false to block them. A bouncer for invalid values." },
          { name: "ctx", type: "void *", desc: "Your own pointer, handed to hooks so they can reach shared state." },
          { name: "binding_ctx", type: "void *", desc: "Context slot reserved for language bindings (the C++ API uses it internally)." },
          { name: "lifecycle_ctx", type: "void *", desc: "Context used by the meta addon for runtime-defined types." },
          { name: "ctx_free", type: "ecs_ctx_free_t", desc: "Called to free ctx when the component is unregistered." },
          { name: "binding_ctx_free", type: "ecs_ctx_free_t", desc: "Frees binding_ctx." },
          { name: "lifecycle_ctx_free", type: "ecs_ctx_free_t", desc: "Frees lifecycle_ctx." }
        ]
      },
      {
        type: "code",
        heading: "A component that owns memory",
        lang: "c",
        title: "ECS_CTOR/ECS_DTOR/... generate correctly-shaped hook functions",
        src: "typedef struct {\n  char *value;\n} Name;\n\nECS_COMPONENT(world, Name);\n\nECS_CTOR(Name, ptr, { ptr->value = NULL; })\nECS_DTOR(Name, ptr, { free(ptr->value); })\nECS_COPY(Name, dst, src, {\n  free(dst->value);\n  dst->value = strdup(src->value);\n})\nECS_MOVE(Name, dst, src, {\n  free(dst->value);\n  dst->value = src->value;\n  src->value = NULL;\n})\n\necs_set_hooks(world, Name, {\n  .ctor = ecs_ctor(Name),\n  .dtor = ecs_dtor(Name),\n  .copy = ecs_copy(Name),\n  .move = ecs_move(Name)\n});"
      },
      {
        type: "text",
        heading: "Hooks or observers?",
        html: "<p>Rule of thumb: <strong>type hooks for resources, observers for gameplay</strong>. Hooks are single, ordered, and always run — right for memory safety. Observers can be many, can be added or removed at runtime, and can match complex queries — right for behavior. The component hooks (<code>on_add</code>/<code>on_set</code>/<code>on_remove</code>) sit in between: use them when being first (or last) in line matters, like validating or normalizing values before observers see them.</p>"
      }
    ],
    related: ["events", "cmp-registration", "lifecycle"]
  },
  {
    id: "cmp-toggle",
    parent: "components",
    order: 6,
    title: "Enabling & Disabling",
    code: "CMP-06",
    tagline: "A light switch for components — flip the bit, keep the data",
    intro: "Sometimes you want a component to stop counting without throwing away its value: pause an AI, suspend a collider, mute a sound source. Toggling flips a single bit instead of removing the component — queries treat the entity as if it doesn't have it, but the data stays put, ready to be switched back on.",
    sections: [
      {
        type: "code",
        heading: "Flipping the switch",
        lang: "c",
        src: "ECS_COMPONENT(world, Position);\necs_add_id(world, ecs_id(Position), EcsCanToggle);\n\necs_entity_t e = ecs_insert(world, ecs_value(Position, {10, 20}));\n\necs_enable_component(world, e, Position, false);\nassert(!ecs_is_enabled(world, e, Position));\n\necs_enable_component(world, e, Position, true);\nassert(ecs_is_enabled(world, e, Position));"
      },
      {
        type: "diagram",
        heading: "Where the switch lives",
        spec: {
          type: "grid",
          title: "Table [Position] with a toggle bitset",
          cols: ["Entity", "Position", "enabled bit"],
          rows: [
            ["e1", "10, 20", "1"],
            ["e2", "3, 5", "0"],
            ["e3", "7, 7", "1"]
          ],
          note: "One bit per row, stored next to the column. Queries skip rows whose bit is 0 — e2 acts as if it has no Position, but its {3, 5} is still there."
        }
      },
      {
        type: "text",
        heading: "Why and when",
        html: "<p>Removing a component moves the entity to a different table — copying its other components along. Toggling writes one bit and moves nothing, so it's much cheaper for frequent on/off flips, and it preserves the value.</p><p>The fine print:</p><ul><li>Only components with the <code>CanToggle</code> trait can be toggled; the trait tells the storage to maintain the bitset.</li><li>Toggling doesn't <em>add</em> anything: the entity must actually have the component for a query to ever match it.</li><li><code>CanToggle</code> adds a small cost to query iteration for that component — every matched table row has to consult the bitset, even for entities that never toggle. Don't sprinkle it on everything.</li><li>Queries can match the bitset itself by flagging a term with <code>ECS_TOGGLE</code>.</li></ul>"
      }
    ],
    related: ["cmp-traits", "queries", "storage"]
  },
  {
    id: "cmp-sparse",
    parent: "components",
    order: 7,
    title: "Sparse & Non-Fragmenting",
    code: "CMP-07",
    tagline: "Components that live outside the tables and never move",
    intro: "Normally a component's bytes live in a table column, and they move whenever the entity changes tables. The <code>Sparse</code> trait moves a component out of the tables into its own per-component storage, where each entity's value stays at a fixed address for its whole life. <code>DontFragment</code> goes one step further and keeps the component out of table bookkeeping entirely.",
    sections: [
      {
        type: "diagram",
        heading: "Two homes for component data",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "s1", label: "Entity e", sub: "has Position and Health" } ],
            [ { id: "s2", label: "Table [Position, Health]", sub: "Position column: tight array, moves with the entity" },
              { id: "s3", label: "Sparse storage for Health", sub: "one slot per entity, address never changes" } ]
          ],
          edges: [
            { from: "s1", to: "s2", label: "regular" },
            { from: "s1", to: "s3", dashed: true, label: "Sparse" }
          ],
          note: "With Sparse on Health, the table still lists Health in its type — but the bytes live outside it."
        }
      },
      {
        type: "code",
        heading: "Opting in",
        lang: "c",
        src: "ECS_COMPONENT(world, Health);\necs_add_id(world, ecs_id(Health), EcsSparse);\n\nECS_COMPONENT(world, Wounded);\necs_add_id(world, ecs_id(Wounded), EcsDontFragment);"
      },
      {
        type: "text",
        heading: "Sparse: stable pointers, slower queries",
        html: "<p>What you gain:</p><ul><li><strong>Pointer stability</strong> — a pointer from <code>get</code> stays valid when the entity changes tables. Essential for components that other code holds pointers into, and for types that can't be moved at all (non-movable C++ types are marked sparse automatically).</li><li><strong>No move cost</strong> — big components stop being copied around on every add/remove of <em>other</em> components.</li></ul><p>What you pay: queries can no longer stream the component from a contiguous column — each entity's value is a lookup away. Sparse trades query speed for add/remove speed. All ECS operations and queries still work as expected. Note that adding or removing a sparse component itself still changes the entity's table, since the table type records that the entity has it.</p>"
      },
      {
        type: "text",
        heading: "DontFragment: for the very rare",
        html: "<p><code>DontFragment</code> uses the same sparse storage but additionally keeps the component <em>out of table types</em>. Why that matters: a component held by only a handful of entities would otherwise split those entities into their own nearly-empty tables (fragmentation), which slows every query that touches them. With <code>DontFragment</code>, adding the component doesn't create or change tables at all.</p><p>The trade-offs are real, so reserve it for genuinely sparse data:</p><ul><li>The component doesn't show up in an entity's type, and monitors can't watch it (they compare tables, and this component isn't in any).</li><li>Some query features don't work with it yet: <code>Or</code>, optional terms, <code>AndFrom</code>/<code>NotFrom</code>, inheritance and transitivity.</li><li>Plain operations, relationships (including exclusive ones), simple queries, wildcards and query variables all work.</li></ul>"
      }
    ],
    related: ["storage", "cmp-pair-ids", "queries"]
  }
]);
