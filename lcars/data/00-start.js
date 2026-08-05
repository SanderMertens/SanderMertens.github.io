window.FLECS_TOUR.register([
  {
    id: "start",
    parent: null,
    order: 1,
    title: "Start Here",
    code: "START",
    tagline: "Welcome aboard — what Flecs is and how to use this tour",
    intro: "Flecs is a fast and lightweight <em>Entity Component System</em> (ECS): a way of building games and simulations where you describe your world as <em>things</em> (entities), <em>data about things</em> (components), and <em>logic that runs on things</em> (systems and queries). This tour walks you through every part of it, from first principles down to the machinery under the hood.",
    sections: [
      {
        type: "text",
        heading: "How the tour works",
        html: "<p>The panel on the left is a map of everything in Flecs, organized from broad to deep. Every section starts simple and gets more detailed as you drill down — you can stop at whatever depth you're comfortable with.</p><ul><li>Click any section on the left, or the cards at the bottom of each page, to drill in.</li><li>Use the <strong>&#8592; &#8594;</strong> arrow keys (or the buttons at the bottom) to walk the whole tour in order, like a book.</li><li>Press <strong>/</strong> to search for any concept by name.</li></ul><p>Every page opens with a plain-language explanation, then goes deeper: how it works, what the important datatypes look like field by field, and diagrams of what happens inside.</p>"
      },
      {
        type: "diagram",
        heading: "The shape of the journey",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "t1", label: "Core concepts", sub: "entities, components" } ],
            [ { id: "t2", label: "Storage & queries", sub: "how data is found fast" } ],
            [ { id: "t3", label: "Behavior", sub: "events, systems, script" } ],
            [ { id: "t4", label: "Tooling", sub: "reflection, REST, stats" } ]
          ],
          edges: [
            { from: "t1", to: "t2" },
            { from: "t2", to: "t3" },
            { from: "t3", to: "t4" }
          ],
          note: "You can jump anywhere, but the decks are ordered so each builds on the last."
        }
      }
    ]
  },
  {
    id: "what-is-ecs",
    parent: "start",
    order: 1,
    title: "What is an ECS?",
    code: "START-01",
    tagline: "Describe things by what they have, not what they are",
    intro: "An Entity Component System is a way of organizing a program around <em>data</em>. Instead of building objects that bundle data and behavior together, you keep three things separate: <em>entities</em> (ids that represent things), <em>components</em> (pieces of data you attach to them), and <em>systems</em> (functions that run on every entity that has certain components).",
    sections: [
      {
        type: "text",
        heading: "The spreadsheet analogy",
        html: "<p>Imagine a giant spreadsheet. Every row is a <strong>thing</strong> in your game: a spaceship, a planet, a laser bolt. Every column is a <strong>kind of data</strong>: position, speed, health. A cell is filled in only if that thing has that kind of data.</p><p>In ECS words: rows are <strong>entities</strong>, columns are <strong>components</strong>, and a <strong>system</strong> is a rule like &quot;every frame, for each row that has both Position and Velocity, add the velocity to the position&quot;.</p><p>The magic is that nothing about a spaceship is hard-coded. A spaceship is just &quot;a row with Position, Velocity, Health and a Sprite&quot;. Want an asteroid? Same columns minus the engine sound. Want a ghost ship? Remove the Collider column from that one row. You compose behavior by mixing data, the way you'd order pizza toppings, instead of designing a family tree of classes up front.</p>"
      },
      {
        type: "diagram",
        heading: "Rows and columns",
        spec: {
          type: "grid",
          title: "Your game world as a spreadsheet",
          cols: ["Entity", "Position", "Velocity", "Health", "Sprite"],
          rows: [
            ["Spaceship", "10, 20", "1, 0", "100", "ship.png"],
            ["Asteroid", "40, 12", "-2, 1", "50", "rock.png"],
            ["Space station", "80, 80", "", "500", "base.png"],
            ["Camera", "0, 0", "", "", ""]
          ],
          note: "Empty cells simply mean the entity doesn't have that component."
        }
      },
      {
        type: "text",
        heading: "Why do it this way?",
        html: "<p>Two big reasons:</p><ul><li><strong>Speed.</strong> Computers are fastest when they read memory in a straight line, like reading a book page by page instead of jumping between shelves. ECS stores all the Positions next to each other, all the Velocities next to each other, so a system that updates thousands of entities streams through memory instead of chasing pointers.</li><li><strong>Flexibility.</strong> Because behavior is defined by which components an entity has, you can change what something <em>is</em> at runtime just by adding or removing data. No class hierarchies to redesign.</li></ul>"
      }
    ],
    related: ["what-is-flecs", "storage"]
  },
  {
    id: "what-is-flecs",
    parent: "start",
    order: 2,
    title: "What is Flecs?",
    code: "START-02",
    tagline: "A tiny C library with a lot of ship inside",
    intro: "Flecs is an ECS written in plain C (with a C++ API on top), small enough to drop into any project as a single <code>flecs.c</code> and <code>flecs.h</code>. Beyond the core ECS it ships a set of optional <em>addons</em>: systems and pipelines, reflection, a scripting language, JSON serialization, a REST API, statistics, and more.",
    sections: [
      {
        type: "text",
        heading: "What makes Flecs, Flecs",
        html: "<p>A few ideas show up everywhere in Flecs, and this tour keeps coming back to them:</p><ul><li><strong>Everything is an entity.</strong> Components are entities. Systems are entities. Even queries and modules are entities. This sounds odd at first, but it means one set of tools (names, hierarchies, reflection, serialization) works on everything.</li><li><strong>Relationships are first-class.</strong> You can say &quot;this entity <em>likes</em> that entity&quot; or &quot;this is a <em>child of</em> that&quot; directly in the data model, and query over it.</li><li><strong>Queries are a language.</strong> Flecs has a small query language that can express things like &quot;all entities with Position whose parent has a Window&quot;, evaluated by a little virtual machine.</li><li><strong>Batteries included, but optional.</strong> Every addon can be compiled out. The core doesn't need any of them.</li></ul>"
      },
      {
        type: "diagram",
        heading: "The layer cake",
        spec: {
          type: "stack",
          layers: [
            { label: "Your game / simulation" },
            { label: "Addons", sub: "systems, pipeline, meta, script, JSON, REST, stats..." },
            { label: "Flecs core", sub: "entities, components, relationships, queries, observers" },
            { label: "Storage engine", sub: "tables, indexes, the table graph" },
            { label: "OS abstraction", sub: "threads, time, memory — swappable" }
          ],
          note: "Each layer only depends on the ones below it."
        }
      }
    ],
    related: ["world", "systems"]
  },
  {
    id: "first-program",
    parent: "start",
    order: 3,
    title: "Your First Program",
    code: "START-03",
    tagline: "Sixty seconds from zero to a moving entity",
    intro: "Here is the smallest useful Flecs program: create a world, define a component, create an entity, move it with a system. Everything else in this tour is a deeper look at what these few lines set in motion.",
    sections: [
      {
        type: "code",
        heading: "Hello, world",
        lang: "c",
        title: "main.c",
        src: "#include <flecs.h>\n\ntypedef struct {\n  float x, y;\n} Position, Velocity;\n\nvoid Move(ecs_iter_t *it) {\n  Position *p = ecs_field(it, Position, 0);\n  Velocity *v = ecs_field(it, Velocity, 1);\n  for (int i = 0; i < it->count; i++) {\n    p[i].x += v[i].x;\n    p[i].y += v[i].y;\n  }\n}\n\nint main(void) {\n  ecs_world_t *world = ecs_init();\n\n  ECS_COMPONENT(world, Position);\n  ECS_COMPONENT(world, Velocity);\n\n  ECS_SYSTEM(world, Move, EcsOnUpdate, Position, Velocity);\n\n  ecs_entity_t e = ecs_entity(world, { .name = \"MyShip\" });\n  ecs_set(world, e, Position, {0, 0});\n  ecs_set(world, e, Velocity, {1, 2});\n\n  while (ecs_progress(world, 0)) { }\n\n  return ecs_fini(world);\n}"
      },
      {
        type: "text",
        heading: "What just happened",
        html: "<p>Line by line, in tour order:</p><ul><li><code>ecs_init</code> creates a <strong>world</strong> — the container that holds everything. That's the next deck.</li><li><code>ECS_COMPONENT</code> registers a C struct as a <strong>component</strong>, which (surprise) is itself an entity.</li><li><code>ECS_SYSTEM</code> declares a <strong>system</strong>: run <code>Move</code> during the update phase, for every entity that has Position and Velocity.</li><li><code>ecs_entity</code> + <code>ecs_set</code> create an <strong>entity</strong> and attach data to it. Behind the scenes it lands in a <strong>table</strong> with other entities that have the exact same components.</li><li><code>ecs_progress</code> runs one frame of the <strong>pipeline</strong>, which runs all systems in order.</li></ul><p>The rest of the tour unpacks each of those bold words — and everything connected to them.</p>"
      }
    ],
    related: ["world", "components", "systems"]
  },
  {
    id: "world",
    parent: null,
    order: 2,
    title: "The World",
    code: "WLD",
    tagline: "The container everything lives in",
    intro: "The <code>ecs_world_t</code> is the universe of your simulation: every entity, every component, every query and system lives inside one. You create it with <code>ecs_init()</code>, tear it down with <code>ecs_fini()</code>, and hand it to almost every Flecs function as the first argument.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the world itself and the things most tightly bound to it: entities and their ids, how entities get names, and how they form parent-child hierarchies.</p>"
      }
    ]
  },
  {
    id: "components",
    parent: null,
    order: 3,
    title: "Components & Relationships",
    code: "CMP",
    tagline: "The data you attach to things, and the links between things",
    intro: "Components are the pieces of data you attach to entities — a Position struct, a Health number, or just a label with no data at all. Relationships extend the idea: instead of attaching plain data, you attach a <em>link to another entity</em>, like &quot;child of the carrier&quot; or &quot;likes Alice&quot;.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers everything you can add to an entity: components with data, tags without data, relationship pairs, the traits that change how components behave, and the hooks that run when component data is created, copied or destroyed.</p>"
      }
    ]
  },
  {
    id: "storage",
    parent: null,
    order: 4,
    title: "Storage Engine",
    code: "STO",
    tagline: "Where the bytes actually live",
    intro: "Under every entity and component is a storage engine built around <em>tables</em>: groups of entities that have exactly the same set of components, stored in tight arrays. Understanding tables explains almost everything about why Flecs is fast — and what operations cost.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck goes under the floor plates: tables and archetypes, the graph that connects them, and the indexes that let Flecs find any entity or component in constant time.</p>"
      }
    ]
  },
  {
    id: "queries",
    parent: null,
    order: 5,
    title: "Queries",
    code: "QRY",
    tagline: "Ask the world questions, get fast answers",
    intro: "A query finds all entities that match a list of conditions, like &quot;has Position and Velocity, but not Frozen&quot;. Queries are how systems find the entities they run on, and they range from simple component filters to graph searches with variables, evaluated by a small virtual machine.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the query language, the two big evaluation strategies — cached and uncached — and the machinery behind each: rematching, change detection, the query compiler and VM, and the iterator you use to read results.</p>"
      }
    ]
  },
  {
    id: "events",
    parent: null,
    order: 6,
    title: "Observers & Events",
    code: "EVT",
    tagline: "Run code the moment something changes",
    intro: "Observers let you react to changes: run this function when a component is added, removed, or set. Under the hood is an event system that can also carry your own custom events, and propagate them along relationships like a shout echoing down a corridor.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the built-in events, observers and how they match, custom events, event propagation, and monitors.</p>"
      }
    ]
  },
  {
    id: "lifecycle",
    parent: null,
    order: 7,
    title: "Prefabs & Lifecycle",
    code: "LIF",
    tagline: "Templates, cleanup rules, and safely changing the world mid-flight",
    intro: "This deck is about the life story of entities: stamping many entities from a prefab template, what happens when entities are deleted (and what gets cleaned up with them), and how Flecs safely queues up changes you make while it is iterating.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>Prefabs and inheritance, cleanup policies, and the deferring/staging machinery that makes structural changes safe during iteration and across threads.</p>"
      }
    ]
  },
  {
    id: "systems",
    parent: null,
    order: 8,
    title: "Systems & Execution",
    code: "SYS",
    tagline: "The logic that runs every frame, in the right order",
    intro: "A system is a query plus a function: every frame, run this code on every matching entity. The systems addon and its friends — pipeline, timer, app — turn a pile of systems into an ordered, optionally multithreaded frame loop you drive with a single call to <code>ecs_progress()</code>.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers systems, the pipeline and its phases, running systems across threads, timers and rate filters, the app addon's main loop, and organizing code into modules.</p>"
      }
    ]
  },
  {
    id: "reflection",
    parent: null,
    order: 9,
    title: "Reflection & Types",
    code: "RFL",
    tagline: "Teach Flecs what your structs look like",
    intro: "The meta addon lets you describe your component types to Flecs at runtime — this struct has a float called x, then a float called y. Once Flecs knows the shape of your data it can print it, serialize it, edit it in the Explorer, and attach units like meters or seconds to it.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the type description system (structs, enums, bitmasks, arrays, vectors, opaque types), the cursor API for poking at values generically, the serializer, and the units addon.</p>"
      }
    ]
  },
  {
    id: "script",
    parent: null,
    order: 10,
    title: "Flecs Script",
    code: "SCR",
    tagline: "Describe your scene in text, reload it while running",
    intro: "Flecs Script is a small language for declaring entities, components and hierarchies in plain text files instead of C code. It has variables, expressions, loops and templates, and scripts can be hot-reloaded while your game is running.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the script syntax, how scripts build hierarchies, templates, variables and expressions, the built-in function library, and how managed scripts update a live world.</p>"
      }
    ]
  },
  {
    id: "remote",
    parent: null,
    order: 11,
    title: "JSON & Remote API",
    code: "NET",
    tagline: "Your world, as text, over the wire",
    intro: "The JSON addon turns entities, queries and whole worlds into JSON and back. The HTTP and REST addons put a tiny web server inside your game so tools — most famously the Flecs Explorer — can inspect and edit the live world from a browser.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers JSON serialization and deserialization, the embedded HTTP server, the REST API, and how the Flecs Explorer talks to your world.</p>"
      }
    ]
  },
  {
    id: "observability",
    parent: null,
    order: 12,
    title: "Monitoring & Debugging",
    code: "OBS",
    tagline: "Instruments, alarms, and the ship's log",
    intro: "Flecs can watch itself: the stats addon samples performance counters, metrics turn your component data into tracked time series, alerts raise alarms when queries match things that shouldn't exist, and the doc and log addons keep everything explained and traceable.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers statistics, user-defined metrics, alerts, attaching documentation to entities, the logging framework, and the journal.</p>"
      }
    ]
  },
  {
    id: "internals",
    parent: null,
    order: 13,
    title: "Under the Hood",
    code: "INT",
    tagline: "The engine room: allocators, data structures, and the OS layer",
    intro: "The lowest deck: the custom data structures Flecs is built on, the command queue that records deferred operations, the poly type system that lets different objects share interfaces, and the OS abstraction layer that makes Flecs run anywhere.",
    sections: [
      {
        type: "text",
        heading: "What's in this deck",
        html: "<p>This deck covers the building blocks: vectors, sparse sets, maps and allocators, the command queue, the poly object system, and the swappable OS API.</p>"
      }
    ]
  }
]);
