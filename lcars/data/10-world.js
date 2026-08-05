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
    parent: "world",
    order: 2,
    title: "World Flags & Modes",
    code: "WLD-02",
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
          note: "The deferring machinery behind this has its own pages in the Commands deck."
        }
      }
    ],
    related: ["wld-lifecycle", "commands", "systems"]
  }
]);
