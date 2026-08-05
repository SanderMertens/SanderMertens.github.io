window.FLECS_TOUR.register([
  {
    id: "sys-anatomy",
    parent: "systems",
    order: 1,
    title: "Anatomy of a System",
    code: "SYS-01",
    tagline: "A query plus a function, saved as an entity",
    intro: "A system is a standing order: <em>every time you run, find all entities that match this query and call this function on them</em>. You create one with the <code>ECS_SYSTEM</code> macro or by filling in an <code>ecs_system_desc_t</code>, and Flecs stores it as an entity — with a name, a phase, and everything else an entity can have.",
    sections: [
      {
        type: "text",
        heading: "The standing order",
        html: "<p>Think of a restaurant kitchen. Instead of shouting instructions at every cook individually, the chef posts standing orders on the wall: &quot;every table that has ordered soup and has no soup yet: bring soup&quot;. A system is exactly that. The <strong>query</strong> part says <em>who</em> it applies to (&quot;entities with Position and Velocity&quot;), and the <strong>callback</strong> part says <em>what to do</em> (&quot;add velocity to position&quot;).</p><p>Because the query is created once and kept up to date by the storage, running a system doesn't search the world from scratch — it walks a pre-matched list of tables. The callback receives an <code>ecs_iter_t</code> and reads component arrays with <code>ecs_field</code>, just like plain query iteration.</p>"
      },
      {
        type: "diagram",
        heading: "What a system is made of",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "q", label: "Query", sub: "who: Position, Velocity" },
              { id: "cb", label: "Callback", sub: "what: Move()" } ],
            [ { id: "sys", label: "System entity", sub: "name, phase, timers..." } ],
            [ { id: "pipe", label: "Pipeline", sub: "runs it every frame" },
              { id: "manual", label: "ecs_run", sub: "or you run it yourself" } ]
          ],
          edges: [
            { from: "q", to: "sys" },
            { from: "cb", to: "sys" },
            { from: "sys", to: "pipe" },
            { from: "sys", to: "manual", dashed: true }
          ]
        }
      },
      {
        type: "code",
        heading: "Two ways to create one",
        lang: "c",
        title: "Macro and descriptor forms of the same system",
        src: "void Move(ecs_iter_t *it) {\n  Position *p = ecs_field(it, Position, 0);\n  Velocity *v = ecs_field(it, Velocity, 1);\n  for (int i = 0; i < it->count; i++) {\n    p[i].x += v[i].x;\n    p[i].y += v[i].y;\n  }\n}\n\nECS_SYSTEM(world, Move, EcsOnUpdate, Position, [in] Velocity);\n\necs_entity_t move = ecs_system(world, {\n  .entity = ecs_entity(world, {\n    .name = \"Move\",\n    .add = ecs_ids( ecs_dependson(EcsOnUpdate) )\n  }),\n  .query.terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn }\n  },\n  .callback = Move\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_system_desc_t",
        summary: "Everything you can fill in when creating a system with ecs_system_init().",
        members: [
          { name: "_canary", type: "int32_t", desc: "Internal validity check. Leave at zero." },
          { name: "entity", type: "ecs_entity_t", desc: "An existing entity to turn into the system (optional). This is how a system gets its name and extra tags." },
          { name: "query", type: "ecs_query_desc_t", desc: "The query that decides which entities the system runs on. Same descriptor as a standalone query." },
          { name: "phase", type: "ecs_entity_t", desc: "The pipeline phase to run in. Added to the system both as a plain tag and as a (DependsOn, phase) pair." },
          { name: "callback", type: "ecs_iter_action_t", desc: "The function to run for each query result. Called once per matched table, so it can fire multiple times per frame." },
          { name: "run", type: "ecs_run_action_t", desc: "Optional function that replaces the default runner. It receives the whole iterator once and drives the iteration itself with ecs_iter_next()." },
          { name: "ctx", type: "void*", desc: "Your own pointer, made available to the callback through the iterator. Useful for handing a system some settings or state." },
          { name: "ctx_free", type: "ecs_ctx_free_t", desc: "Function Flecs calls to clean up ctx when the system is deleted." },
          { name: "callback_ctx", type: "void*", desc: "Extra context tied to the callback, used by language bindings (like the C++ API) to store their wrapper objects." },
          { name: "callback_ctx_free", type: "ecs_ctx_free_t", desc: "Cleanup function for callback_ctx." },
          { name: "run_ctx", type: "void*", desc: "Extra context tied to the run function, also for language bindings." },
          { name: "run_ctx_free", type: "ecs_ctx_free_t", desc: "Cleanup function for run_ctx." },
          { name: "interval", type: "ecs_ftime_t", desc: "Run at most once every this many seconds. Setting it gives the system its own built-in timer." },
          { name: "rate", type: "int32_t", desc: "Run once every N ticks of the system's tick source (or every N frames if it has none)." },
          { name: "tick_source", type: "ecs_entity_t", desc: "Another entity (a timer, rate filter, or even another system) that decides when this system ticks." },
          { name: "multi_threaded", type: "bool", desc: "If true, the system's matched entities are split across worker threads." },
          { name: "immediate", type: "bool", desc: "If true, the system runs on the real world instead of the readonly staged world, so its operations apply instantly. Cannot be combined with multi_threaded." }
        ]
      },
      {
        type: "text",
        heading: "Systems are entities",
        html: "<p>The value returned by <code>ecs_system_init</code> is a regular entity id. That means you can look a system up by name, put it in a hierarchy, add tags to it, and — most usefully — disable it by adding the <code>EcsDisabled</code> tag (or calling <code>ecs_enable(world, sys, false)</code>). Disabled systems are skipped by the pipeline, because the pipeline finds systems with an ordinary query and queries ignore disabled entities.</p><p>To change a system after creation (say, its interval or context), use <code>ecs_system_update()</code>. The one thing you cannot change afterwards is the query.</p>"
      }
    ],
    related: ["queries", "sys-pipeline", "sys-run-vs-callback"]
  },
  {
    id: "sys-run-vs-callback",
    parent: "sys-anatomy",
    order: 1,
    title: "Callback vs Run",
    code: "SYS-01A",
    tagline: "Get called per table, or take the wheel yourself",
    intro: "A system has two slots for code: <code>callback</code>, which Flecs calls once for every matched table, and <code>run</code>, which Flecs calls exactly once and which then drives the whole iteration itself. Most systems only need <code>callback</code>; <code>run</code> is for when you want code before, after, or around the loop.",
    sections: [
      {
        type: "text",
        heading: "Two loops, one visible",
        html: "<p>Plain query iteration has two loops: an outer loop over matched tables (<code>ecs_query_next</code>) and an inner loop over the entities in each table. A system <code>callback</code> only contains the inner loop — the outer loop is driven for you, which is why the callback can be invoked several times per frame, once per matched table.</p><p>Setting <code>run</code> instead hands you the outer loop too. Flecs calls your run function once with a fresh iterator, and you advance it yourself. That lets you do setup before the first table, cleanup after the last one, or skip iteration entirely.</p><p>One gotcha from the header: inside a run function, don't assume the iterator is a plain query iterator. When the system is multithreaded it may be a worker iterator, so always advance it with <code>ecs_iter_next(it)</code>, not <code>ecs_query_next</code>.</p>"
      },
      {
        type: "code",
        heading: "A run function",
        lang: "c",
        title: "Setup once, then iterate all tables",
        src: "void MoveRun(ecs_iter_t *it) {\n  printf(\"frame starts\\n\");\n\n  while (ecs_iter_next(it)) {\n    Position *p = ecs_field(it, Position, 0);\n    Velocity *v = ecs_field(it, Velocity, 1);\n    for (int i = 0; i < it->count; i++) {\n      p[i].x += v[i].x;\n      p[i].y += v[i].y;\n    }\n  }\n\n  printf(\"frame done\\n\");\n}\n\necs_system(world, {\n  .entity = ecs_entity(world, {\n    .name = \"Move\",\n    .add = ecs_ids( ecs_dependson(EcsOnUpdate) )\n  }),\n  .query.terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn }\n  },\n  .run = MoveRun\n});"
      },
      {
        type: "text",
        heading: "Which to pick",
        html: "<p>Use <code>callback</code> unless you have a reason not to — it's the simplest and there is no meaningful performance difference. Reach for <code>run</code> when you need per-frame setup or teardown, want to bail out early, or need custom control over how tables are visited. If both are set, the run function is in charge and may invoke the callback through the default runner behavior.</p>"
      }
    ],
    related: ["sys-manual-run", "queries"]
  },
  {
    id: "sys-manual-run",
    parent: "sys-anatomy",
    order: 2,
    title: "Running Systems Manually",
    code: "SYS-01B",
    tagline: "Fire a system yourself with ecs_run",
    intro: "Not every system should run every frame on a schedule. Pass <code>0</code> as the phase and the system stays out of the pipeline entirely; then you invoke it whenever you like with <code>ecs_run()</code> — with your own timestep and even your own parameter.",
    sections: [
      {
        type: "text",
        heading: "Why run manually?",
        html: "<p>A manual system is like a fire drill: the plan is written down and everyone knows their role, but it only happens when someone pulls the alarm. Because the system's query is matched to tables ahead of time, pulling the alarm is cheap — none of the matching work happens at call time. That makes manual systems much faster than gathering a list of entities by hand every time you need one-off logic over a group.</p><p>Typical uses: logic that runs in response to a game event (&quot;apply the explosion now&quot;), tools code, or systems you want to call from inside another system.</p>"
      },
      {
        type: "code",
        heading: "Create and run",
        lang: "c",
        title: "Phase 0 keeps it out of the pipeline",
        src: "ECS_SYSTEM(world, ApplyDamage, 0, Health, [in] Damage);\n\necs_run(world, ecs_id(ApplyDamage), 0.0, NULL);\n\ntypedef struct { float amount; } ExplosionParams;\nExplosionParams params = { .amount = 25 };\necs_run(world, ecs_id(ApplyDamage), 0.0, &params);"
      },
      {
        type: "text",
        heading: "param and interrupted_by",
        html: "<p>The last argument of <code>ecs_run</code> shows up inside the system as <code>it-&gt;param</code> — a small envelope you can slip to the system with call-specific data.</p><p>A system can also stop early by setting <code>it-&gt;interrupted_by</code> to an entity id. <code>ecs_run</code> returns that id, which turns a manual system into a search tool: iterate until you find the entity you want, store it in <code>interrupted_by</code>, and the caller gets it back as the return value.</p><p>There is also <code>ecs_run_worker()</code>, which runs the system on just one slice of its entities — that is the building block the pipeline uses to spread a system across threads.</p>"
      }
    ],
    related: ["sys-threads", "sys-tasks"]
  },
  {
    id: "sys-tasks",
    parent: "sys-anatomy",
    order: 3,
    title: "Tasks",
    code: "SYS-01C",
    tagline: "Systems that run without matching any entities",
    intro: "A task is a system with no entities to match — its query is empty, or only reads from a fixed source like a singleton. Tasks run once per frame and are the ECS way to say &quot;just run this code at this point in the frame&quot;.",
    sections: [
      {
        type: "text",
        heading: "Code without a crowd",
        html: "<p>Most systems are like a mail carrier walking a route: the query is the list of addresses. A task is the office worker who doesn't walk a route at all — they just do one job at their desk each morning. No addresses, one visit.</p><p>Tasks are useful for things that aren't per-entity: polling input, printing stats, kicking off network reads. Because they're still systems, they get scheduled in a phase, can have intervals and rate filters, and can be enabled or disabled like everything else.</p>"
      },
      {
        type: "code",
        heading: "A task, plain and with a singleton",
        lang: "c",
        title: "An empty query, then a fixed source",
        src: "void PrintTime(ecs_iter_t *it) {\n  printf(\"Time: %f\\n\", it->delta_time);\n}\n\nECS_SYSTEM(world, PrintTime, EcsOnUpdate, 0);\n\nvoid PrintGameTime(ecs_iter_t *it) {\n  Game *g = ecs_field(it, Game, 0);\n  printf(\"Time: %f\\n\", g->time);\n}\n\necs_add_id(world, ecs_id(Game), EcsSingleton);\nECS_SYSTEM(world, PrintGameTime, EcsOnUpdate, Game);"
      },
      {
        type: "text",
        heading: "Fixed sources",
        html: "<p>When a task queries a <strong>singleton</strong> (a component that lives on one well-known entity), the system callback is still invoked once, with the component available through <code>ecs_field</code> and <code>it-&gt;count</code> possibly zero. This is the tidy way to give frame-level code access to global state such as game settings, without reaching for global variables.</p>"
      }
    ],
    related: ["sys-timers", "world"]
  },
  {
    id: "sys-pipeline",
    parent: "systems",
    order: 2,
    title: "The Pipeline",
    code: "SYS-02",
    tagline: "One call runs the whole frame, in order",
    intro: "The pipeline is the conductor of the frame. When you call <code>ecs_progress()</code>, it figures out which systems should run, in what order, where to pause and merge queued-up changes, and which threads do what — then runs the whole program of the frame from a single call.",
    sections: [
      {
        type: "text",
        heading: "What ecs_progress actually does",
        html: "<p>A frame is like a shift in a factory. When the whistle blows (<code>ecs_progress</code>):</p><ul><li>The clock is read: if you passed <code>0</code> for <code>delta_time</code>, Flecs measures the time since the last frame itself (and sleeps first if you set a target FPS).</li><li>The world is put in <strong>readonly mode</strong>: while systems run, structural changes like <code>ecs_add</code> or <code>ecs_remove</code> don't happen immediately — they're written down as commands, so nobody rearranges the shelves while workers are walking the aisles.</li><li>The pipeline runs its <strong>schedule</strong>: systems grouped into batches, with <strong>sync points</strong> between batches where the queued commands are applied.</li><li>At the end of the frame the world is unlocked, remaining commands are merged, and frame statistics are updated.</li></ul><p>Interestingly, the pipeline itself is driven by a query: a pipeline is an entity with a query that matches <em>system entities</em>. Each frame it iterates that query to build the list of systems to run.</p>"
      },
      {
        type: "diagram",
        heading: "One frame, start to finish",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "begin", label: "Frame begins", sub: "delta_time measured, FPS sleep" } ],
            [ { id: "lock", label: "World locked", sub: "readonly: ops become commands" } ],
            [ { id: "batch", label: "Run systems", sub: "phase by phase, batch by batch" },
              { id: "sync", label: "Sync point", sub: "merge queued commands" } ],
            [ { id: "end", label: "Frame ends", sub: "final merge, world unlocked" } ]
          ],
          edges: [
            { from: "begin", to: "lock" },
            { from: "lock", to: "batch" },
            { from: "batch", to: "sync", label: "when needed" },
            { from: "sync", to: "batch", dashed: true, label: "continue" },
            { from: "batch", to: "end" }
          ],
          note: "The batch/sync loop repeats until every system in the schedule has run."
        }
      },
      {
        type: "code",
        heading: "Driving frames",
        lang: "c",
        title: "The classic main loop",
        src: "while (ecs_progress(world, 0)) { }\n\necs_progress(world, delta_time);\n\necs_run_pipeline(world, my_pipeline, delta_time);"
      },
      {
        type: "text",
        heading: "What's below this page",
        html: "<p>The children of this page unpack the pieces: the <strong>built-in phases</strong> that give every system a slot in the frame, how <strong>ordering</strong> between systems is decided, when and why <strong>sync points</strong> are inserted, and how to build a <strong>custom pipeline</strong> with its own rules.</p>"
      }
    ],
    related: ["sys-phases", "sys-sync-points", "lifecycle", "sys-delta-time"]
  },
  {
    id: "sys-phases",
    parent: "sys-pipeline",
    order: 1,
    title: "Builtin Phases",
    code: "SYS-02A",
    tagline: "Named slots in the frame, from load to store",
    intro: "A phase is a named slot in the frame — &quot;early&quot;, &quot;main update&quot;, &quot;just before rendering&quot; — that systems attach to. Phases are ordinary entities tagged with <code>EcsPhase</code>, and a system joins one through a <code>DependsOn</code> relationship, which the <code>ECS_SYSTEM</code> macro adds for you.",
    sections: [
      {
        type: "diagram",
        heading: "The frame, top to bottom",
        spec: {
          type: "stack",
          layers: [
            { label: "OnStart", sub: "only the very first frame" },
            { label: "OnLoad", sub: "bring data in: input, network receive" },
            { label: "PostLoad", sub: "process what just came in" },
            { label: "PreUpdate", sub: "prepare for game logic" },
            { label: "OnUpdate", sub: "the main event: gameplay, movement" },
            { label: "OnValidate", sub: "check the results: collision detection" },
            { label: "PostUpdate", sub: "react to validation: resolve collisions" },
            { label: "PreStore", sub: "get data ready to leave: transforms for rendering" },
            { label: "OnStore", sub: "hand data off: rendering, network send" }
          ],
          note: "Systems in the same phase run together; phases run in this order."
        }
      },
      {
        type: "text",
        heading: "Phases are entities with DependsOn",
        html: "<p>There is no hard-coded phase list inside the scheduler. Each builtin phase is just an entity with the <code>EcsPhase</code> tag, ordered by <code>DependsOn</code> relationships. The builtin pipeline query walks the <code>DependsOn</code> graph (with the query's <code>cascade</code> feature — a breadth-first walk up a relationship) to sort systems by how deep their phase sits in the graph.</p><p>A subtle trick from the source: the builtin phases do <em>not</em> depend directly on each other. Each one depends on a hidden anonymous entity, and those anonymous entities form the chain. Why? Disabling a phase disables everything that depends on it, transitively. With the hidden chain, you can disable <code>EcsPreUpdate</code> — silencing all its systems — without also knocking out <code>EcsOnUpdate</code> and everything after it.</p><p><code>EcsOnStart</code> is special: systems that depend on it run only once, during the very first <code>ecs_progress()</code> call, via a separate startup pipeline. The main builtin pipeline explicitly excludes them afterwards.</p>"
      },
      {
        type: "code",
        heading: "Making your own phases",
        lang: "c",
        title: "Custom phases slot into the same graph",
        src: "ecs_entity_t Physics = ecs_new_w_id(world, EcsPhase);\necs_entity_t Collisions = ecs_new_w_id(world, EcsPhase);\n\necs_add_pair(world, Physics, EcsDependsOn, EcsOnUpdate);\necs_add_pair(world, Collisions, EcsDependsOn, Physics);\n\nECS_SYSTEM(world, Collide, Collisions, Position, Velocity);"
      },
      {
        type: "text",
        heading: "What goes where",
        html: "<p>The names encode a simple idea: data flows <em>into</em> the world at the start of the frame and <em>out of</em> it at the end.</p><ul><li><strong>OnLoad / PostLoad</strong>: read the outside world — keyboard, gamepad, network packets — and turn it into components.</li><li><strong>PreUpdate / OnUpdate</strong>: the simulation itself. Most gameplay systems live in OnUpdate.</li><li><strong>OnValidate / PostUpdate</strong>: check what the simulation did (find collisions) and fix it up (push entities apart).</li><li><strong>PreStore / OnStore</strong>: prepare and deliver data to the outside — build transforms, issue draw calls, send packets.</li></ul>"
      }
    ],
    related: ["sys-ordering", "components"]
  },
  {
    id: "sys-ordering",
    parent: "sys-pipeline",
    order: 2,
    title: "System Ordering",
    code: "SYS-02B",
    tagline: "Who goes first, and how to change it",
    intro: "Within a frame, systems are ordered by two rules: first by phase (a topological sort over the <code>DependsOn</code> graph — dependencies always run before dependents), then within a phase by entity id, which usually means declaration order.",
    sections: [
      {
        type: "text",
        heading: "The two sorting keys",
        html: "<p>Imagine boarding a plane: first by group number (phases), then within a group, by the order people lined up (declaration order).</p><ul><li><strong>Between phases</strong>: the builtin pipeline query traverses <code>DependsOn</code> with <code>cascade</code>, so systems on a phase deeper in the graph run later. If InputSystem depends on PreUpdate and MoveSystem on OnUpdate, InputSystem goes first.</li><li><strong>Within a phase</strong>: the builtin pipeline sets an <code>order_by</code> function that compares entity ids. Since ids are handed out in increasing order, systems normally run in the order you declared them.</li></ul>"
      },
      {
        type: "text",
        heading: "The recycled-id gotcha",
        html: "<p>&quot;Normally&quot; hides a trap. Entity ids get <strong>recycled</strong>: delete an entity, and its id can be handed to the next entity created. If you delete entities and then declare a system, that system might receive a recycled, <em>lower</em> id than a system declared before it — and jump ahead in the order.</p><p>The practical advice from the docs: avoid deleting entities while you are still registering systems. If you can't, create a custom pipeline with your own <code>order_by</code> function that sorts by something you control.</p>"
      },
      {
        type: "text",
        heading: "Turning systems off",
        html: "<p>Ordering also decides who runs at all, because the pipeline is a query and queries skip disabled entities:</p><ul><li>Disable one system: <code>ecs_enable(world, Move, false)</code>, or add <code>EcsDisabled</code> directly.</li><li>Disable a phase: every system that depends on it (transitively) is excluded.</li><li>Disable a parent: the builtin pipeline also excludes systems whose parent entity is disabled — which is how you switch off a whole module at once.</li></ul>"
      }
    ],
    related: ["sys-phases", "sys-modules", "queries"]
  },
  {
    id: "sys-sync-points",
    parent: "sys-pipeline",
    order: 3,
    title: "Sync Points & Merging",
    code: "SYS-02C",
    tagline: "Where the frame pauses to apply queued changes",
    intro: "While systems run, structural operations like <code>ecs_add</code> are queued as commands instead of applied. A sync point is a planned pause in the frame where the queue is flushed, so systems after it can see everything that systems before it changed. Flecs inserts them automatically — but only where the systems' declared reads and writes prove one is needed.",
    sections: [
      {
        type: "text",
        heading: "Why commands queue up at all",
        html: "<p>Systems iterate tightly packed component arrays. If a system could add or remove components mid-iteration, entities would move between tables and arrays could reallocate under the iterator's feet — like remodeling a supermarket aisle while shoppers are in it. So during the frame the world is <strong>readonly</strong>: writes to component values you matched are fine, but structural operations become commands in a per-thread queue. This is the same deferring machinery covered in the lifecycle deck.</p><p>Left alone, all commands would merge at the end of the frame. That's often fine — but sometimes system B genuinely needs to see what system A enqueued. That's what sync points are for.</p>"
      },
      {
        type: "diagram",
        heading: "A sync point in action",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "sa", label: "SetTransform", sub: "declares [out] Transform()" } ],
            [ { id: "cq", label: "Command queue", sub: "set Transform commands pile up" } ],
            [ { id: "sp", label: "Sync point", sub: "queue flushed into tables" } ],
            [ { id: "sb", label: "Render", sub: "reads [in] Transform" } ]
          ],
          edges: [
            { from: "sa", to: "cq", label: "enqueue" },
            { from: "cq", to: "sp", label: "merge" },
            { from: "sp", to: "sb", label: "sees fresh data" }
          ],
          note: "The scheduler saw a possible write followed by a read, and split the frame between them."
        }
      },
      {
        type: "text",
        heading: "How the scheduler decides",
        html: "<p>Flecs can't look inside your callback, so by default it assumes a system enqueues nothing. The schedule is built from what systems <em>declare</em> in their query terms:</p><ul><li>The pipeline tracks, per component, whether any earlier system in the current batch <em>could have written</em> it via commands.</li><li>When it encounters a system that <em>reads</em> such a component, it closes the batch and inserts a sync point before that system.</li><li>Inactive systems (no matched entities) and disabled systems are ignored, so you never pay for merges that can't matter.</li><li>A system marked <code>immediate</code> always gets its own sync point, because it must run against the real, merged world.</li></ul><p>To declare &quot;I enqueue commands for Transform even though I don't match it&quot;, use an <code>[out]</code> term with an empty-entity source — written <code>[out] Transform()</code> in the DSL. The mirror-image <code>[in] Transform()</code> declares a read done via <code>ecs_get</code>.</p>"
      },
      {
        type: "code",
        heading: "Annotating writes and reads",
        lang: "c",
        title: "Telling the scheduler what it can't see",
        src: "ECS_SYSTEM(world, SetTransform, EcsOnUpdate, Position, [out] Transform());\n\nECS_SYSTEM(world, ReadTransform, EcsOnUpdate, Position, [in] Transform());\n\necs_system(world, {\n  .query.terms = {\n    { ecs_id(Position) },\n    { .id = ecs_id(Transform),\n      .inout = EcsOut,\n      .src.flags = EcsIsEntity,\n      .src.id = 0 }\n  },\n  .callback = SetTransform\n});"
      },
      {
        type: "text",
        heading: "Immediate systems",
        html: "<p>Sometimes queuing is the wrong tool entirely. Picture assigning plates to waiters: to give a plate only to a free waiter, each assignment must be visible <em>immediately</em>, or you'd hand ten plates to the same person. Setting <code>.immediate = true</code> makes a system run while the world is <em>not</em> readonly, so operations apply on the spot. The costs: immediate systems are always single-threaded, and operations on the entity currently being iterated still have to be deferred (you can't remodel the aisle you're standing in). Inside an immediate system, <code>ecs_defer_suspend()</code> / <code>ecs_defer_resume()</code> let you briefly switch between queued and instant operations.</p>"
      }
    ],
    related: ["lifecycle", "sys-threads", "internals"]
  },
  {
    id: "sys-custom-pipelines",
    parent: "sys-pipeline",
    order: 4,
    title: "Custom Pipelines",
    code: "SYS-02D",
    tagline: "Write your own rules for what runs and when",
    intro: "A pipeline is nothing more than a query over system entities plus the machinery that runs the results in order. That means you can replace the builtin one: write a query that matches the systems you want, wrap it in an <code>ecs_pipeline_desc_t</code>, and tell the world to use it.",
    sections: [
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_pipeline_desc_t",
        summary: "What you fill in to create a pipeline with ecs_pipeline_init().",
        members: [
          { name: "entity", type: "ecs_entity_t", desc: "An existing entity to attach the pipeline to (optional), which gives it a name." },
          { name: "query", type: "ecs_query_desc_t", desc: "The query that selects which system entities are part of the pipeline, and in what order. All regular query features apply: terms, order_by, group_by, cascade traversal." }
        ]
      },
      {
        type: "code",
        heading: "The builtin pipeline, spelled out",
        lang: "c",
        title: "What Flecs itself registers",
        src: "ecs_pipeline_init(world, &(ecs_pipeline_desc_t){\n  .query.terms = {\n    { .id = EcsSystem },\n    { .id = EcsPhase, .src.id = EcsCascade, .trav = EcsDependsOn },\n    { .id = EcsDisabled, .src.id = EcsUp, .trav = EcsDependsOn,\n      .oper = EcsNot },\n    { .id = EcsDisabled, .src.id = EcsUp, .trav = EcsChildOf,\n      .oper = EcsNot }\n  }\n});"
      },
      {
        type: "text",
        heading: "Reading that query",
        html: "<p>Line by line: match entities that are systems; sort them by walking up the <code>DependsOn</code> graph to their phase (<code>cascade</code>); skip systems whose phase chain is disabled; skip systems whose parent is disabled. The real one adds one more term to exclude <code>OnStart</code> systems after the first frame, and an <code>order_by</code> that compares entity ids within a phase.</p><p>One classic mistake when writing your own: listing phases as separate terms, like <code>OnUpdate, OnPhysics, OnRender</code>. Query terms are AND-ed, so that matches only systems that have <em>all three</em> tags. What you almost always want is OR: <code>OnUpdate || OnPhysics || OnRender</code> — and then <code>order_by</code> or <code>group_by</code> to control the order, since OR alone guarantees nothing about it.</p>"
      },
      {
        type: "code",
        heading: "A tag-based pipeline",
        lang: "c",
        title: "Match every system with the Foo tag",
        src: "ECS_TAG(world, Foo);\n\necs_entity_t pipeline = ecs_pipeline_init(world, &(ecs_pipeline_desc_t){\n  .query.terms = {\n    { .id = EcsSystem },\n    { .id = Foo }\n  }\n});\n\necs_set_pipeline(world, pipeline);\n\nECS_SYSTEM(world, Move, Foo, Position, Velocity);\n\necs_progress(world, 0);"
      },
      {
        type: "text",
        heading: "Details worth knowing",
        html: "<p>The first term of a custom pipeline query must match <code>EcsSystem</code> — the pipeline runs systems, after all. When you pass an entity as the phase argument of <code>ECS_SYSTEM</code>, it is added both as a plain tag and as <code>(DependsOn, phase)</code>, so the macro keeps working whether or not your pipeline uses <code>DependsOn</code>. Pass <code>0</code> and add tags manually if you want neither.</p><p><code>ecs_set_pipeline()</code> swaps the pipeline used by <code>ecs_progress()</code>; <code>ecs_run_pipeline()</code> runs any extra pipeline on demand, and <code>ecs_pipeline_update()</code> replaces the query of an existing one. Custom pipelines get the same sync point analysis and threading as the builtin one.</p>"
      }
    ],
    related: ["queries", "sys-phases", "sys-ordering"]
  },
  {
    id: "sys-threads",
    parent: "systems",
    order: 3,
    title: "Multithreading",
    code: "SYS-03",
    tagline: "Slice each system's entities across worker threads",
    intro: "Flecs multithreads by splitting <em>data</em>, not systems: with <code>ecs_set_threads(world, 4)</code>, a system marked <code>multi_threaded</code> runs on all four threads at once, each thread processing its own quarter of the matched entities. Systems still run one at a time — it's each system's workload that fans out.",
    sections: [
      {
        type: "text",
        heading: "The paper route model",
        html: "<p>Imagine one long street of mailboxes and four paper carriers. You don't give each carrier a different chore — you give them all the same chore (&quot;deliver papers&quot;) and split the street into four segments. That's exactly what the scheduler does: every table matched by a multithreaded system is cut into N slices, one per thread. A table of 1000 entities on 4 threads: thread 0 takes rows 0–249, thread 1 takes 250–499, and so on.</p><p>The slicing is stable: the same entity is handled by the same thread until the next sync point. In the ideal case a whole batch of systems runs to completion with zero locking, because no two threads ever touch the same entity's row — and each thread has its own <strong>stage</strong> with its own command queue, the same staging mechanism from the lifecycle deck.</p>"
      },
      {
        type: "diagram",
        heading: "One table, four threads",
        spec: {
          type: "grid",
          title: "Table [Position, Velocity] with 1000 entities",
          cols: ["Thread", "Entity rows", "Runs"],
          rows: [
            ["main (0)", "0 - 249", "Move, slice 1 of 4"],
            ["worker 1", "250 - 499", "Move, slice 2 of 4"],
            ["worker 2", "500 - 749", "Move, slice 3 of 4"],
            ["worker 3", "750 - 999", "Move, slice 4 of 4"]
          ],
          note: "Every thread runs the same system on a different slice; single-threaded systems run only on the main thread."
        }
      },
      {
        type: "code",
        heading: "Turning it on",
        lang: "c",
        title: "Both the world and the system must opt in",
        src: "ecs_set_threads(world, 4);\n\necs_system(world, {\n  .entity = ecs_entity(world, {\n    .name = \"Move\",\n    .add = ecs_ids( ecs_dependson(EcsOnUpdate) )\n  }),\n  .query.terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn }\n  },\n  .callback = Move,\n  .multi_threaded = true\n});"
      },
      {
        type: "text",
        heading: "The rules of the road",
        html: "<p>Things to know before flipping the switch:</p><ul><li><strong>Both switches needed.</strong> <code>ecs_set_threads</code> creates the workers; each system decides with <code>multi_threaded</code> whether it uses them. Systems are single-threaded by default and then run only on the main thread.</li><li><strong>Stages equal threads.</strong> Setting N threads sets the world's stage count to N; the main thread is stage 0 and N−1 worker threads are spawned to run alongside it during the frame.</li><li><strong>Sync points are the meeting places.</strong> At each sync point the threads rendezvous, the per-stage command queues are merged on the main thread, and the workers are released into the next batch.</li><li><strong>immediate excludes multithreading.</strong> A system that runs on the real world can't safely share it with workers, so <code>immediate</code> systems are always single-threaded.</li><li>Calling <code>ecs_set_threads</code> again reconfigures the pool — but never do it while a pipeline is running.</li></ul>"
      }
    ],
    related: ["sys-sync-points", "lifecycle", "sys-task-threads"]
  },
  {
    id: "sys-task-threads",
    parent: "sys-threads",
    order: 1,
    title: "Task Threads",
    code: "SYS-03A",
    tagline: "Borrow your engine's job system instead of owning threads",
    intro: "Many engines already have a job system — a pool of workers that runs short tasks. <code>ecs_set_task_threads()</code> lets Flecs plug into it: instead of keeping long-lived threads of its own, Flecs asks your job system for short-lived task workers around every world update.",
    sections: [
      {
        type: "text",
        heading: "Threads vs tasks",
        html: "<p>With <code>ecs_set_threads</code>, Flecs hires full-time employees: worker threads created once, kept alive across frames. With <code>ecs_set_task_threads</code>, Flecs hires day labor: at each <code>ecs_progress</code>, it calls the OS API's <code>task_new_</code> callback once per task worker needed, and at the end of the update calls <code>task_join_</code> to wind each one down.</p><p>The trick is that the task callbacks live in <code>ecs_os_api_t</code> — Flecs' swappable OS layer — and use the same signatures as the thread callbacks. Point them at your job system and Flecs multithreads through it, so ECS work and your engine's other jobs share one pool instead of fighting over cores.</p>"
      },
      {
        type: "code",
        heading: "Switching over",
        lang: "c",
        title: "Same slicing behavior, different workers",
        src: "ecs_os_set_api_defaults();\necs_os_api_t api = ecs_os_get_api();\napi.task_new_ = my_job_system_spawn;\napi.task_join_ = my_job_system_wait;\necs_os_set_api(&api);\n\necs_set_task_threads(world, 4);\n\nbool using_tasks = ecs_using_task_threads(world);"
      },
      {
        type: "text",
        heading: "Ground rules",
        html: "<p>Systems don't change at all — <code>multi_threaded</code> works identically, and entities are sliced across task workers the same way. The constraints: your job system must be able to run the requested number of simultaneous tasks for the whole duration of <code>ecs_progress</code>, you can't reconfigure while a pipeline runs, and <code>ecs_set_threads</code> and <code>ecs_set_task_threads</code> are mutually exclusive — calling one ends the other's setup.</p>"
      }
    ],
    related: ["sys-threads", "internals"]
  },
  {
    id: "sys-timers",
    parent: "systems",
    order: 4,
    title: "Timers & Tick Sources",
    code: "SYS-04",
    tagline: "Run systems on a clock instead of every frame",
    intro: "Not everything needs to happen 60 times a second. The timer addon lets a system run on an interval (&quot;once per second&quot;), fire once after a timeout, or follow the beat of another entity — a <em>tick source</em> — like an orchestra section watching the conductor.",
    sections: [
      {
        type: "text",
        heading: "Kitchen timers for systems",
        html: "<p>A timer is an entity with an <code>EcsTimer</code> component: a little stopwatch that accumulates <code>delta_time</code> each frame and &quot;fires&quot; when it crosses its timeout. There are two flavors:</p><ul><li><strong>Interval</strong> (<code>ecs_set_interval</code>): fires repeatedly, resetting itself each time — the kitchen timer you keep rewinding.</li><li><strong>Timeout</strong> (<code>ecs_set_timeout</code>): fires once, then removes its <code>EcsTimer</code> — the egg timer you set and forget.</li></ul><p>The simplest use puts the timer on the system itself: set <code>.interval = 1.0</code> in the system descriptor (or call <code>ecs_set_interval</code> on the system entity), and the system runs at 1&nbsp;Hz. On frames when the timer hasn't fired, the pipeline simply skips the system.</p>"
      },
      {
        type: "code",
        heading: "Timers in practice",
        lang: "c",
        title: "On the system, or as a shared entity",
        src: "ECS_SYSTEM(world, Move, EcsOnUpdate, Position, [in] Velocity);\necs_set_interval(world, ecs_id(Move), 1.0);\n\necs_entity_t tick = ecs_set_interval(world, 0, 1.0);\necs_set_tick_source(world, ecs_id(Move), tick);\n\necs_stop_timer(world, tick);\necs_start_timer(world, tick);\necs_reset_timer(world, tick);\n\necs_randomize_timers(world);"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsTimer",
        summary: "The stopwatch component behind interval and timeout timers.",
        members: [
          { name: "timeout", type: "ecs_ftime_t", desc: "How long the timer runs before it fires, in seconds. For interval timers this is the interval." },
          { name: "time", type: "ecs_ftime_t", desc: "The stopwatch itself: accumulates delta_time each frame until it reaches timeout." },
          { name: "overshoot", type: "ecs_ftime_t", desc: "How far past the timeout the last frame landed. Carried over so the reported elapsed time doesn't drift when frames don't line up exactly." },
          { name: "fired_count", type: "int32_t", desc: "How many times the timer has fired." },
          { name: "active", type: "bool", desc: "Whether the timer is currently running. ecs_stop_timer() clears it, ecs_start_timer() sets it." },
          { name: "single_shot", type: "bool", desc: "True for timeout timers: fire once, then stop." }
        ]
      },
      {
        type: "text",
        heading: "Tick sources: sharing the beat",
        html: "<p>Any entity with a timer (or rate filter) becomes a <strong>tick source</strong>: each frame it gets an <code>EcsTickSource</code> component whose <code>tick</code> field says &quot;this frame counts&quot; and whose <code>time_elapsed</code> carries the time since the last tick. Point a system at one with <code>ecs_set_tick_source()</code> or the <code>tick_source</code> field of the system descriptor.</p><p>Why share instead of giving each system its own interval? Two systems with separate 1-second timers drift apart — especially if one gets disabled for a while and its timer stops counting. Two systems on the <em>same</em> tick source are guaranteed to fire on the same frame, every time. Systems are themselves tick sources, so one system can march to the beat of another.</p><p>When a system is driven by a timer, <code>it-&gt;delta_system_time</code> tells it how much time actually passed since its last run — use that instead of <code>delta_time</code> for movement math.</p>"
      }
    ],
    related: ["sys-rate-filters", "sys-delta-time"]
  },
  {
    id: "sys-rate-filters",
    parent: "sys-timers",
    order: 1,
    title: "Rate Filters",
    code: "SYS-04A",
    tagline: "Tick once every N ticks of something else",
    intro: "A rate filter is a counter, not a clock: it watches a tick source and fires on every Nth tick. Because it counts ticks instead of measuring seconds, it stays perfectly in step with its source — something two independent timers can never promise.",
    sections: [
      {
        type: "text",
        heading: "Counting beats, not seconds",
        html: "<p>Suppose timer A has interval 2.0 and timer B has interval 4.0. You'd expect B to fire on exactly every other tick of A — but timers accumulate floating-point time independently, so rounding and frame boundaries make them drift. A rate filter fixes this by construction: <code>ecs_set_rate(world, 0, 2, a)</code> creates an entity that ticks exactly once per two ticks of <code>a</code>. No clock, no drift.</p><p>If you pass <code>0</code> as the source, the rate filter counts <em>frames</em> — ticks of <code>ecs_progress</code> itself. That's what the <code>.rate</code> field on a system descriptor sets up: <code>.rate = 2</code> means &quot;run every other frame&quot;.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsRateFilter",
        summary: "The counter component behind rate filters.",
        members: [
          { name: "src", type: "ecs_entity_t", desc: "The tick source being watched. Zero means count frames." },
          { name: "rate", type: "int32_t", desc: "Fire once every this many ticks of the source." },
          { name: "tick_count", type: "int32_t", desc: "How many source ticks have been counted so far." },
          { name: "time_elapsed", type: "ecs_ftime_t", desc: "Time accumulated since the filter last fired, passed on to systems as their elapsed time." }
        ]
      },
      {
        type: "diagram",
        heading: "Nested tick sources",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "sec", label: "each_second", sub: "interval timer, 1.0s" } ],
            [ { id: "min", label: "each_minute", sub: "rate 60 of each_second" } ],
            [ { id: "hour", label: "each_hour", sub: "rate 60 of each_minute" } ],
            [ { id: "sys", label: "CleanupSystem", sub: "tick_source: each_hour" } ]
          ],
          edges: [
            { from: "sec", to: "min", label: "every 60 ticks" },
            { from: "min", to: "hour", label: "every 60 ticks" },
            { from: "hour", to: "sys", label: "runs" }
          ],
          note: "Rate filters are tick sources themselves, so they chain into clean hierarchies of time."
        }
      },
      {
        type: "code",
        heading: "Building the chain",
        lang: "c",
        title: "Seconds, minutes, hours",
        src: "ecs_entity_t each_second = ecs_set_interval(world, 0, 1.0);\n\necs_entity_t each_minute = ecs_set_rate(world, 0, 60, each_second);\n\necs_entity_t each_hour = ecs_set_rate(world, 0, 60, each_minute);\n\necs_set_tick_source(world, ecs_id(CleanupSystem), each_hour);"
      },
      {
        type: "text",
        heading: "Details",
        html: "<p>A rate filter with rate 1 ticks in lockstep with its source — handy as a pass-through when you want several systems to share one beat. And since systems are tick sources too, <code>.tick_source = each_second, .rate = 60</code> on a system descriptor means &quot;run every 60th time that entity ticks&quot;. If the entity you point at is not a tick source at all, the system simply never runs.</p>"
      }
    ],
    related: ["sys-timers", "sys-delta-time"]
  },
  {
    id: "sys-app",
    parent: "systems",
    order: 5,
    title: "The App Addon",
    code: "SYS-05",
    tagline: "A main loop in a box, friendly to browsers",
    intro: "The app addon wraps the whole &quot;while running, progress the world&quot; loop into one call: <code>ecs_app_run(world, &amp;desc)</code>. It exists because on some platforms — most famously Emscripten, which runs C in a web browser — you are not allowed to write your own blocking main loop, so the platform must be able to take it over.",
    sections: [
      {
        type: "text",
        heading: "Why outsource your main loop?",
        html: "<p>A desktop game can spin <code>while (ecs_progress(world, 0)) {}</code> forever. A browser can't: the page would freeze, because the browser needs control back after every frame to redraw and handle input. Emscripten solves this by letting the environment call your frame function on a schedule — which means <em>your code can't own the loop</em>.</p><p>The app addon splits the loop into two replaceable pieces: a <strong>run action</strong> (the loop) and a <strong>frame action</strong> (one frame, by default just <code>ecs_progress</code>). On a normal platform the default run action loops the frame action until the world quits. On Emscripten, a different run action hands the frame action to the browser. Your <code>main()</code> looks the same either way.</p>"
      },
      {
        type: "diagram",
        heading: "Who calls whom",
        spec: {
          type: "stack",
          layers: [
            { label: "ecs_app_run", sub: "applies desc: fps, threads, REST, stats" },
            { label: "run action", sub: "default: loop; Emscripten: browser-driven" },
            { label: "frame action", sub: "default: ecs_app_run_frame" },
            { label: "ecs_progress", sub: "one frame of the pipeline" }
          ],
          note: "Both actions can be swapped with ecs_app_set_run_action / ecs_app_set_frame_action."
        }
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_app_desc_t",
        summary: "The settings you pass to ecs_app_run().",
        members: [
          { name: "target_fps", type: "ecs_ftime_t", desc: "The frame rate to aim for. Applied to the world with ecs_set_target_fps(), which makes each frame sleep to hit the target." },
          { name: "delta_time", type: "ecs_ftime_t", desc: "A fixed time step per frame. Leave at 0 to have frame time measured from the real clock." },
          { name: "threads", type: "int32_t", desc: "Number of worker threads, passed to ecs_set_threads()." },
          { name: "frames", type: "int32_t", desc: "How many frames to run before stopping. 0 means run until ecs_quit() is called." },
          { name: "enable_rest", type: "bool", desc: "Starts the REST API server so the Flecs Explorer can connect to the running app from a browser." },
          { name: "enable_stats", type: "bool", desc: "Imports the stats addon, which periodically collects performance statistics." },
          { name: "port", type: "uint16_t", desc: "The HTTP port the REST API listens on. 0 picks the default (27750)." },
          { name: "init", type: "ecs_app_init_action_t", desc: "A function run once before the main loop starts. Handy for setup that must happen after the app has configured the world." },
          { name: "ctx", type: "void*", desc: "Reserved for custom run and frame actions to pass their own data around." }
        ]
      },
      {
        type: "code",
        heading: "A whole game shell",
        lang: "c",
        title: "Explorer-ready main in a few lines",
        src: "int main(void) {\n  ecs_world_t *world = ecs_init();\n\n  ECS_COMPONENT(world, Position);\n  ECS_COMPONENT(world, Velocity);\n  ECS_SYSTEM(world, Move, EcsOnUpdate, Position, [in] Velocity);\n\n  return ecs_app_run(world, &(ecs_app_desc_t){\n    .target_fps = 60,\n    .enable_rest = true,\n    .enable_stats = true\n  });\n}"
      },
      {
        type: "text",
        heading: "Odds and ends",
        html: "<p><code>ecs_app_run</code> copies the descriptor, applies <code>target_fps</code> and <code>threads</code> to the world (skipped on Emscripten, where the browser paces frames and threads aren't used), imports the REST and stats modules if requested, then invokes the run action. When the loop ends, the world is told to quit. On Emscripten builds with REST enabled, the addon even serves Explorer requests directly from inside the wasm image — no network socket needed.</p>"
      }
    ],
    related: ["remote", "observability", "sys-delta-time"]
  },
  {
    id: "sys-delta-time",
    parent: "systems",
    order: 6,
    title: "Delta Time & Frame Control",
    code: "SYS-06",
    tagline: "Keeping the simulation honest about time",
    intro: "Frames never take exactly the same amount of time, so systems scale their work by <code>delta_time</code>: the seconds elapsed since the last frame, delivered in every iterator. Flecs can measure it for you, accept it from your engine, or pin the frame rate by sleeping.",
    sections: [
      {
        type: "text",
        heading: "Why multiply by delta_time",
        html: "<p>If a system moves an entity 1 unit per frame, the entity moves twice as fast on a 120&nbsp;Hz monitor as on a 60&nbsp;Hz one. Multiply by <code>delta_time</code> instead — units per <em>second</em> times seconds elapsed — and the speed is the same everywhere, like a car's speedometer reading the same whether you check it every second or every two.</p>"
      },
      {
        type: "code",
        heading: "Frame-rate independent movement",
        lang: "c",
        title: "Inside a system callback",
        src: "void Move(ecs_iter_t *it) {\n  Position *p = ecs_field(it, Position, 0);\n  Velocity *v = ecs_field(it, Velocity, 1);\n  for (int i = 0; i < it->count; i++) {\n    p[i].x += v[i].x * it->delta_time;\n    p[i].y += v[i].y * it->delta_time;\n  }\n}"
      },
      {
        type: "text",
        heading: "Where the number comes from",
        html: "<p>The value you pass to <code>ecs_progress(world, dt)</code> is what systems see. Three modes:</p><ul><li><strong>You measure</strong>: your engine already tracks frame time; pass it in. Recommended if you don't need Flecs' time management — pass a non-zero constant like 1.0 if you don't care about real time at all.</li><li><strong>Flecs measures</strong>: pass <code>0</code>, and the frame-begin code reads the OS clock and computes the time since the last frame.</li><li><strong>No clock available</strong>: if the OS layer has no time support, Flecs falls back to <code>1 / target_fps</code>, or 1/60 as a last resort.</li></ul><p>Two related values ride along: <code>it-&gt;delta_system_time</code> is the time since <em>this system</em> last ran (different from <code>delta_time</code> when the system runs on a timer), and the world keeps running totals like <code>world_time_total</code> in its info struct.</p>"
      },
      {
        type: "text",
        heading: "Pinning the frame rate",
        html: "<p>Call <code>ecs_set_target_fps(world, 60)</code> (or set <code>target_fps</code> in the app descriptor) and each <code>ecs_progress</code> starts by sleeping off the difference between the target frame time and how long the last frame actually took. The sleep is done in small slices — one eighth of the remaining time at a go, re-checking the clock after each nap — because a single big OS sleep is imprecise and can oversleep badly. The result is a frame limiter that's accurate without spinning the CPU at 100%.</p><p>Frame boundaries are also where per-frame bookkeeping happens: the frame counter increments, timers accumulate, and the stats addon snapshots its counters. If you drive Flecs without <code>ecs_progress</code>, the same bookkeeping is available manually via <code>ecs_frame_begin()</code> / <code>ecs_frame_end()</code>.</p>"
      }
    ],
    related: ["sys-timers", "sys-app", "observability"]
  },
  {
    id: "sys-modules",
    parent: "systems",
    order: 7,
    title: "Modules",
    code: "SYS-07",
    tagline: "Package components and systems into importable units",
    intro: "A module is a shippable box of ECS content: components, systems, phases, prefabs — anything — registered by one import function and stored under one entity. <code>ECS_IMPORT(world, FlecsSystemsPhysics)</code> unpacks the box into the world, exactly once, no matter how many times it's asked.",
    sections: [
      {
        type: "text",
        heading: "Boxes with name tags",
        html: "<p>As projects grow, one giant <code>main()</code> registering fifty systems stops scaling. Modules give every subsystem its own moving box:</p><ul><li><strong>One entity per module.</strong> <code>ECS_MODULE(world, MyPhysics)</code> creates a module entity, and everything the import function registers afterwards becomes a <em>child</em> of it. That's the same parent-child hierarchy entities use everywhere.</li><li><strong>No name collisions.</strong> Because contents are scoped under the module entity, your <code>Position</code> lives at <code>my.physics.Position</code> and can't clash with someone else's. The scope is set automatically during import and restored afterwards.</li><li><strong>Import once.</strong> <code>ecs_import</code> looks the module name up first; if it's already in the world, it returns the existing entity instead of re-registering. Modules can safely import their own dependencies.</li></ul><p>The PascalCase name is translated to a path: <code>MyPhysics</code> becomes the entity <code>my.physics</code>.</p>"
      },
      {
        type: "code",
        heading: "Writing and using a module",
        lang: "c",
        title: "The import function is the box's packing list",
        src: "void MyPhysicsImport(ecs_world_t *world) {\n  ECS_MODULE(world, MyPhysics);\n\n  ECS_COMPONENT(world, Position);\n  ECS_COMPONENT(world, Velocity);\n\n  ECS_SYSTEM(world, Move, EcsOnUpdate, Position, [in] Velocity);\n}\n\nint main(void) {\n  ecs_world_t *world = ecs_init();\n\n  ECS_IMPORT(world, MyPhysics);\n\n  while (ecs_progress(world, 0)) { }\n  return ecs_fini(world);\n}"
      },
      {
        type: "text",
        heading: "Modules and the pipeline",
        html: "<p>Systems in a module are children of the module entity, and the builtin pipeline skips systems whose parent is disabled. So <code>ecs_enable(world, ecs_id(MyPhysics), false)</code> switches off an entire module's systems in one move — and back on again just as easily.</p><p>Flecs' own addons are modules too: importing <code>FlecsPipeline</code> pulls in <code>FlecsSystem</code>, the stats addon is <code>FlecsStats</code>, and so on. For dynamically loaded code there is <code>ecs_import_from_library()</code>, which resolves a module name like <code>flecs.components.transform</code> to a shared library through the OS API.</p>"
      }
    ],
    related: ["world", "sys-ordering", "observability"]
  }
]);
