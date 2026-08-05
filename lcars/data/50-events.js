window.FLECS_TOUR.register([
  {
    id: "evt-builtin-events",
    parent: "events",
    order: 1,
    title: "Builtin Events",
    code: "EVT-01",
    tagline: "The three moments Flecs always announces",
    intro: "Every time an entity gains data, gets new data, or loses data, Flecs rings a bell. There are three builtin bells: <code>OnAdd</code> (a component was added), <code>OnSet</code> (a component was given a value), and <code>OnRemove</code> (a component was taken away). Observers are the code you attach to those bells.",
    sections: [
      {
        type: "text",
        heading: "When each bell rings",
        html: "<p>Think of an entity as a locker. Flecs announces exactly three kinds of changes to a locker:</p><ul><li><strong>OnAdd</strong> rings when a component, tag or pair is <em>actually</em> added. Adding the same component twice only rings once — the second add changes nothing, so there is nothing to announce.</li><li><strong>OnSet</strong> rings every time a component is assigned a value with a <code>set</code> operation, or when you call <code>ecs_modified</code>. It does <em>not</em> ring when a system writes to component memory directly — Flecs can't see plain memory writes, so you call <code>ecs_modified</code> yourself to ring the bell.</li><li><strong>OnRemove</strong> rings when a component is <em>actually</em> removed. Removing something the entity doesn't have rings nothing.</li></ul><p>A single <code>ecs_set</code> on a component the entity doesn't have yet rings two bells: first <code>OnAdd</code> (the component appeared), then <code>OnSet</code> (it got a value). Setting it again only rings <code>OnSet</code>.</p>"
      },
      {
        type: "diagram",
        heading: "What one ecs_set sets in motion",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "a", label: "ecs_set(world, e, Position, ...)", sub: "component not yet on entity" } ],
            [ { id: "b", label: "Construct component", sub: "ctor + on_add hook" },
              { id: "c", label: "Write the value", sub: "then on_set hook" } ],
            [ { id: "d", label: "OnAdd observers", sub: "value not visible yet" },
              { id: "e", label: "OnSet observers", sub: "value is visible" } ]
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "d" },
            { from: "d", to: "c" },
            { from: "c", to: "e" }
          ],
          note: "Hooks belong to the component itself and always run before their matching observers."
        }
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "which operations ring which bells",
        src: "ecs_entity_t e = ecs_new(world);\n\necs_add(world, e, Position);\necs_add(world, e, Position);\n\necs_set(world, e, Position, {10, 20});\n\necs_remove(world, e, Position);\necs_remove(world, e, Position);"
      },
      {
        type: "text",
        heading: "Gotchas worth knowing",
        html: "<p>Three details that trip people up:</p><ul><li>An <code>OnAdd</code> observer that fires as part of a <code>set</code> operation sees the component <em>before</em> the new value is written. For components without a constructor, the value is uninitialized memory.</li><li><code>OnSet</code> also fires for inheritance changes: adding an <code>IsA</code> pair to a prefab produces <code>OnSet</code> for each newly inherited component, setting a component on a prefab notifies its instances, and removing an override re-exposes the prefab value and fires <code>OnSet</code> again. This only happens for components with the <code>(OnInstantiate, Inherit)</code> trait.</li><li>Never emit the builtin events yourself with <code>ecs_emit</code> — Flecs makes assumptions about when they fire.</li></ul>"
      }
    ],
    related: ["evt-observers", "evt-table-events", "components", "lif-prefabs"]
  },
  {
    id: "evt-table-events",
    parent: "evt-builtin-events",
    order: 1,
    title: "Table Events",
    code: "EVT-02",
    tagline: "Hear about new storage shelves, not just their contents",
    intro: "Besides announcing changes to entities, Flecs also announces changes to its own storage: <code>OnTableCreate</code> fires when a new table (a storage group for entities with the same components) comes into existence, and <code>OnTableDelete</code> fires when one is torn down.",
    sections: [
      {
        type: "text",
        heading: "Why you'd listen to shelves",
        html: "<p>Entities that have exactly the same set of components live together in one <em>table</em>. Flecs creates tables lazily: the first time some combination of components appears, a new table is built for it. <code>OnTableCreate</code> and <code>OnTableDelete</code> let you watch that happen.</p><p>This is an advanced tool. Regular game logic almost never needs it — it exists for things that mirror the storage itself, like renderers that keep per-table GPU buffers, or tooling that tracks which archetypes exist.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "watch tables with Position appear",
        src: "ecs_observer(world, {\n    .query.terms = {{ ecs_id(Position) }},\n    .events = { EcsOnTableCreate },\n    .callback = OnPositionTable\n});"
      },
      {
        type: "text",
        heading: "How it behaves",
        html: "<p>The observer's query decides which tables you hear about: the callback runs when a table matching the query is created or deleted. Because tables are created the first time a component combination appears — and cached afterwards — <code>OnTableCreate</code> typically fires early and rarely, not once per entity.</p>"
      }
    ],
    related: ["storage", "evt-observers"]
  },
  {
    id: "evt-observers",
    parent: "events",
    order: 2,
    title: "Observers",
    code: "EVT-03",
    tagline: "A query, a list of events, and a callback",
    intro: "An observer is a tripwire: you describe which entities you care about (a query), which events you care about (like <code>OnAdd</code>), and what to do when both line up (a callback). Where a system runs every frame for all matching entities, an observer runs only at the moment something changes.",
    sections: [
      {
        type: "text",
        heading: "Reactive, not periodic",
        html: "<p>Systems and observers are built from the same parts — a query plus a callback — but they answer different questions. A system asks &quot;what matches right now?&quot; every frame. An observer asks &quot;did an event just happen on something that matches?&quot;.</p><p>Observers are not the same as component <em>hooks</em>. A hook (<code>on_add</code>, <code>on_set</code>, <code>on_remove</code>) is part of a component's interface, like a constructor: there can be only one per component, it can mutate the component, and it always runs before observers (or after, for removes). Observers are for <em>other</em> parts of your code to react: there can be many per component, they can match multi-term queries, they can be added and removed at runtime — and they should never mutate the component they observe. Hooks are also much cheaper to invoke.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "react whenever Position is set",
        src: "void OnSetPosition(ecs_iter_t *it) {\n    Position *p = ecs_field(it, Position, 0);\n    for (int i = 0; i < it->count; i ++) {\n        printf(\"Position set: {%f, %f}\\n\", p[i].x, p[i].y);\n    }\n}\n\necs_observer(world, {\n    .query.terms = {{ ecs_id(Position) }},\n    .events = { EcsOnSet },\n    .callback = OnSetPosition\n});\n\necs_entity_t e = ecs_new(world);\necs_set(world, e, Position, {10, 20});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_observer_desc_t",
        summary: "What you fill in to create an observer with ecs_observer_init() or the ecs_observer() macro.",
        members: [
          { name: "_canary", type: "int32_t", desc: "Safety check used to detect a partially initialized struct. Leave it at 0." },
          { name: "entity", type: "ecs_entity_t", desc: "An existing entity to attach the observer to (optional). Observers are entities too, so you can name them, put them in modules, and disable them." },
          { name: "query", type: "ecs_query_desc_t", desc: "The query that decides which entities this observer cares about. Anything a query can express — multiple terms, operators, traversal — works here." },
          { name: "events", type: "ecs_entity_t[8]", desc: "The events to listen for, like OnAdd, OnRemove, OnSet, Monitor, or your own custom event entities. EcsWildcard listens to everything that matches the query (expensive; use for debugging)." },
          { name: "yield_existing", type: "bool", desc: "When true, the observer is immediately invoked for everything that already matches, as if those events just happened. Makes code order-independent." },
          { name: "global_observer", type: "bool", desc: "Ties the observer to the lifespan of the world instead of creating an entity for it. ecs_observer_init() then doesn't return an entity handle." },
          { name: "callback", type: "ecs_iter_action_t", desc: "The function invoked when an event matches the observer. Receives an iterator, just like a system." },
          { name: "run", type: "ecs_run_action_t", desc: "Optional replacement for the default runner, which matches the event against the query and then calls callback. Override it if you have a faster way to test matches." },
          { name: "ctx", type: "void*", desc: "Your own data pointer, available in the callback via the iterator." },
          { name: "ctx_free", type: "ecs_ctx_free_t", desc: "Function Flecs calls to free ctx when the observer is deleted." },
          { name: "callback_ctx / run_ctx", type: "void*", desc: "Extra context pointers for the callback and run functions, mainly used by language bindings." },
          { name: "callback_ctx_free / run_ctx_free", type: "ecs_ctx_free_t", desc: "Free functions for those two context pointers." },
          { name: "...internal", type: "", desc: "last_event_id, term_index_ and flags_ are for internal use. The exception: flags_ accepts EcsObserverYieldOnCreate / EcsObserverYieldOnDelete to fine-tune yield_existing behavior." }
        ]
      },
      {
        type: "text",
        heading: "Multi-term observers",
        html: "<p>An observer's query can have more than one term, like &quot;Position <em>and</em> Velocity&quot;. Such an observer only fires when the entity matches the <em>whole</em> query. Add Position to an entity: nothing happens. Add Velocity too: now the entity matches, and the observer fires.</p><p>Under the hood, a multi-term observer is built from multiple single-term observers. When any one of them trips, Flecs evaluates the full query against the entity that caused the event, and only invokes your callback if everything matches. Single-term observers skip that evaluation step entirely, which makes them noticeably cheaper.</p>"
      },
      {
        type: "diagram",
        heading: "How a multi-term observer fires",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "op", label: "ecs_add(world, e, Velocity)", sub: "the operation" } ],
            [ { id: "ev", label: "OnAdd event", sub: "for Velocity on e" } ],
            [ { id: "tw", label: "Term tripwire", sub: "one per observer term" } ],
            [ { id: "q", label: "Evaluate full query on e", sub: "Position, Velocity" },
              { id: "cb", label: "Invoke callback", sub: "only if e matches all terms" } ]
          ],
          edges: [
            { from: "op", to: "ev" },
            { from: "ev", to: "tw" },
            { from: "tw", to: "q" },
            { from: "q", to: "cb", label: "match" }
          ],
          note: "Single-term observers skip the query evaluation step, which makes them faster."
        }
      }
    ],
    related: ["evt-observer-matching", "evt-observer-execution", "evt-monitors", "queries", "systems"]
  },
  {
    id: "evt-observer-matching",
    parent: "evt-observers",
    order: 1,
    title: "Matching Details",
    code: "EVT-04",
    tagline: "Filter terms, inverted events, and catching up on the past",
    intro: "Observer queries have a few tricks that plain queries don't need: terms that filter without triggering, events that flip around <code>not</code> terms, tag events that get downgraded, and a switch that replays the present as if it just happened.",
    sections: [
      {
        type: "text",
        heading: "Filter terms",
        html: "<p>By default a multi-term observer fires on events for <em>any</em> of its terms. Sometimes you only care about one term and want the others as conditions. Mark a term with <code>.inout = EcsInOutFilter</code> and events on that term stop triggering the observer — it still has to match, but it's a checkpoint, not a tripwire.</p><p>Terms matched on something other than the event's entity behave like filters too: fixed-source terms (matched on one specific entity) and terms with a non-<code>$this</code> query variable as source don't trigger events when the observer also has regular <code>$this</code> terms.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "trigger on Position only, require Velocity",
        src: "ecs_observer(world, {\n    .query.terms = {\n        { ecs_id(Position) },\n        { ecs_id(Velocity), .inout = EcsInOutFilter }\n    },\n    .events = { EcsOnSet },\n    .callback = OnPosition\n});\n\necs_entity_t e = ecs_new(world);\necs_set(world, e, Position, {10, 20});\necs_set(world, e, Velocity, {1, 2});\necs_set(world, e, Position, {20, 30});"
      },
      {
        type: "text",
        heading: "Inversion and downgrading",
        html: "<p>Observer queries support the same operators as regular queries, and two of them interact with events in clever ways:</p><ul><li><strong>Event inversion.</strong> An <code>OnAdd</code> observer with a <code>not</code> term (&quot;Position, but not Velocity&quot;) also has to fire when Velocity is <em>removed</em> — that's the moment the entity starts matching. Flecs inverts the event on <code>not</code> terms automatically, in both directions, and your callback still sees the observer's own event.</li><li><strong>Event downgrading.</strong> Tags have no value, so they can never produce <code>OnSet</code>. When an <code>OnSet</code> observer has tag terms, events for those terms are downgraded to <code>OnAdd</code> instead of the observer being rejected.</li></ul>"
      },
      {
        type: "text",
        heading: "Yield existing",
        html: "<p>An observer normally only hears about changes that happen after it was created. Set <code>yield_existing</code> and the observer is invoked immediately for everything that already matches — as if the past were replayed for it. This makes startup order stop mattering: entities created before the observer are treated the same as entities created after.</p><ul><li>Works for <code>OnAdd</code>, <code>OnSet</code> and <code>OnRemove</code> events.</li><li>For <code>OnRemove</code> observers, yield existing fires when the <em>observer is deleted</em>, so every add gets a matching remove even if the entities outlive the observer.</li><li>The <code>flags_</code> member accepts <code>EcsObserverYieldOnCreate</code> and <code>EcsObserverYieldOnDelete</code> to pick one behavior explicitly (don't combine them with <code>yield_existing</code>).</li></ul>"
      }
    ],
    related: ["evt-observers", "evt-observer-execution", "queries"]
  },
  {
    id: "evt-observer-execution",
    parent: "evt-observers",
    order: 2,
    title: "When Observers Run",
    code: "EVT-05",
    tagline: "Synchronous with the change — which may be later than you think",
    intro: "Observers run at the moment the operation that triggered them actually happens, on the thread that performs it. The subtlety: inside systems most operations are <em>deferred</em> — queued up and executed later — so the observer runs later too, at the merge.",
    sections: [
      {
        type: "text",
        heading: "Tied to the operation, not the call",
        html: "<p>When you call <code>ecs_add</code> outside a system, the component is added right there, and every <code>OnAdd</code> observer has run by the time the call returns. But when the world is deferring (which it is while systems run), the call only writes a note in a command queue. The component is really added when the queue is flushed at a sync point — and that's when the observer runs. Same code, different timing.</p>"
      },
      {
        type: "diagram",
        heading: "Hooks first, observers second",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "add", label: "Component added" },
              { id: "rem", label: "Component removed" } ],
            [ { id: "addh", label: "on_add hook", sub: "the component's own code" },
              { id: "remo", label: "OnRemove observers", sub: "value still valid here" } ],
            [ { id: "addo", label: "OnAdd observers", sub: "everyone else reacts" },
              { id: "remh", label: "on_remove hook + dtor", sub: "component's own cleanup last" } ]
          ],
          edges: [
            { from: "add", to: "addh" },
            { from: "addh", to: "addo" },
            { from: "rem", to: "remo" },
            { from: "remo", to: "remh" }
          ],
          note: "On the way in, the component's hook goes first. On the way out, observers get one last look before the component is destroyed."
        }
      },
      {
        type: "text",
        heading: "What order can you rely on?",
        html: "<p>Flecs batches commands for efficiency, so only some orderings are guaranteed:</p><ul><li><strong>Observer order is undefined.</strong> Two observers matching the same event may run in any order. Never build logic on it, even if the current order looks right.</li><li><strong>Order between entities is undefined</strong>, and <strong>OnAdd/OnRemove order is undefined</strong> even within one entity — batching may reorder them.</li><li><strong>OnSet order is maintained</strong>: OnSet events arrive in the order they were produced. So is the order of <strong>custom events</strong>.</li><li><strong>Hooks are ordered</strong>: <code>on_add</code> and <code>on_set</code> hooks run before their events; <code>on_remove</code> hooks run after OnRemove observers.</li><li><strong>Children before parents</strong>: when a hierarchy is deleted, OnRemove observers fire for children first, as long as the relationship graph has no cycles.</li></ul><p>Observers can also be disabled like systems, and disabling a module disables every observer in it.</p>"
      }
    ],
    related: ["evt-observers", "lif-deferring", "lif-cleanup", "systems"]
  },
  {
    id: "evt-custom-events",
    parent: "events",
    order: 3,
    title: "Custom Events & emit",
    code: "EVT-06",
    tagline: "Ring your own bells through the same wiring",
    intro: "The event system isn't reserved for Flecs: any entity can be used as an event. You announce it with <code>ecs_emit</code>, saying which event happened, on which entity, and (optionally) for which components — and observers subscribed to that event fire exactly like they do for <code>OnAdd</code>.",
    sections: [
      {
        type: "text",
        heading: "Three ingredients",
        html: "<p>Every event in Flecs — builtin or custom — is made of the same three parts:</p><ul><li><strong>An event</strong>: which bell rang. For custom events this is just an entity you created, like <code>Synchronized</code> or <code>Clicked</code>.</li><li><strong>One or more component ids</strong>: what the bell is about, like <code>Position</code>.</li><li><strong>A source</strong>: the entity it happened to.</li></ul><p>The source entity must actually have the components you emit for — that's what lets Flecs safely hand the observer a pointer to the component value.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "define, observe, and emit a custom event",
        src: "ecs_entity_t Synchronized = ecs_new(world);\n\necs_observer(world, {\n    .query.terms = {{ ecs_id(Position) }},\n    .events = { Synchronized },\n    .callback = OnSynchronizedPosition\n});\n\necs_entity_t e = ecs_insert(world, ecs_value(Position, {10, 20}));\n\necs_emit(world, &(ecs_event_desc_t) {\n    .event = Synchronized,\n    .entity = e,\n    .ids = &(ecs_type_t){\n        .array = (ecs_id_t[]){ ecs_id(Position) },\n        .count = 1\n    }\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_event_desc_t",
        summary: "What you fill in to send an event with ecs_emit() or ecs_enqueue().",
        members: [
          { name: "event", type: "ecs_entity_t", desc: "Which event this is. Only observers listening for this event are notified. Don't emit builtin events like OnAdd yourself." },
          { name: "ids", type: "const ecs_type_t*", desc: "The component ids the event is about. Only observers with a matching component get notified, and each observer is notified at most once even if it matches several ids." },
          { name: "table", type: "ecs_table_t*", desc: "Emit for every entity in this table. The bulk alternative to the entity member." },
          { name: "other_table", type: "ecs_table_t*", desc: "Optional second table, used to communicate the previous or next table when an entity moves between tables." },
          { name: "offset", type: "int32_t", desc: "Skip this many rows of the table before notifying." },
          { name: "count", type: "int32_t", desc: "Notify at most this many entities. Left at 0 it means everything from offset to the end of the table." },
          { name: "entity", type: "ecs_entity_t", desc: "Single-entity shorthand: notify just this entity instead of setting table, offset and count." },
          { name: "param", type: "void*", desc: "Extra data delivered to observers via it->param. The type must be the event itself, registered as a component. Copied into temporary storage when the event is enqueued." },
          { name: "const_param", type: "const void*", desc: "Same as param, but promises the value won't be modified. Also copied when enqueued." },
          { name: "set_ptr", type: "void*", desc: "Optional pointer to the component value the event is about; observers use it instead of fetching from storage. Only valid for a single component id and a single entity." },
          { name: "observable", type: "ecs_poly_t*", desc: "Which observable receives the event. Almost always the world." },
          { name: "flags", type: "ecs_flags32_t", desc: "Event flags, for internal and advanced use." }
        ]
      },
      {
        type: "text",
        heading: "Entity events and event payloads",
        html: "<p>Often you want &quot;something happened to this entity&quot; without naming a component — a button was <code>Clicked</code>. Make an <em>entity observer</em>: subscribe with the <code>Any</code> wildcard as the component and the entity as fixed source, then emit with no <code>ids</code> at all.</p><p>And if the event itself is registered as a component (say a <code>Resize</code> struct with a width and height), you can ship data with it: set <code>param</code> when emitting, and read <code>it-&gt;param</code> in the callback.</p>"
      }
    ],
    related: ["evt-emit-vs-enqueue", "evt-observers", "evt-builtin-events"]
  },
  {
    id: "evt-emit-vs-enqueue",
    parent: "evt-custom-events",
    order: 1,
    title: "Emit vs Enqueue",
    code: "EVT-07",
    tagline: "Shout it now, or drop it in the mailbox",
    intro: "<code>ecs_emit</code> invokes matching observers right now, before the call returns. <code>ecs_enqueue</code> drops the event into the command queue instead, to be delivered when the queue is flushed — which is what you want from inside systems.",
    sections: [
      {
        type: "diagram",
        heading: "Two delivery routes",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "emit", label: "ecs_emit", sub: "synchronous" },
              { id: "enq", label: "ecs_enqueue", sub: "world in deferred mode" } ],
            [ { id: "obs1", label: "Observers run now", sub: "stack data in param is safe" },
              { id: "q", label: "Command queue", sub: "param copied via copy hook" } ],
            [ { id: "flush", label: "ecs_defer_end / sync point", sub: "queue flushed" } ],
            [ { id: "obs2", label: "Observers run at the merge" } ]
          ],
          edges: [
            { from: "emit", to: "obs1" },
            { from: "enq", to: "q" },
            { from: "q", to: "flush" },
            { from: "flush", to: "obs2" },
            { from: "enq", to: "obs1", dashed: true, label: "not deferred" }
          ],
          note: "When the world is not deferring, ecs_enqueue behaves exactly like ecs_emit."
        }
      },
      {
        type: "text",
        heading: "Which one, when",
        html: "<p><strong>Emit</strong> is synchronous: observers have all run by the time it returns. That means it's safe to pass stack variables as the event's <code>param</code> — nothing outlives the call.</p><p><strong>Enqueue</strong> is the deferred-safe version. If the world is in deferred mode (as it is while systems run), the event waits in the command queue until <code>ecs_defer_end</code>. Because delivery happens later, the event data can't live on your stack: Flecs copies <code>param</code> into temporary storage using the event component's <code>copy</code> hook (or a plain byte-copy if none is registered). If the world isn't deferring, enqueue just behaves like emit.</p>"
      }
    ],
    related: ["evt-custom-events", "lif-deferring", "lif-staging"]
  },
  {
    id: "evt-propagation",
    parent: "events",
    order: 4,
    title: "Event Propagation",
    code: "EVT-08",
    tagline: "One change on a parent, heard by the whole family",
    intro: "When an observer's query looks <em>upward</em> — &quot;give me Position from my parent&quot; — events have to travel <em>downward</em> to reach it. Set Position on a parent, and Flecs walks the hierarchy pushing the event to every descendant that could see that component through traversal.",
    sections: [
      {
        type: "text",
        heading: "Echoes down the corridor",
        html: "<p>Queries can traverse relationships: a term like <code>Position(up ChildOf)</code> matches entities whose <em>parent</em> has Position. For observers this creates a puzzle — the event happens on the parent, but the matching entities are the children. Flecs solves it by <em>propagating</em> the event along the relationship, like a shout echoing down a corridor: parent first, then children, then grandchildren.</p><p>Two rules keep this consistent with how queries traverse:</p><ul><li>Propagation only happens along relationships with the <strong>Traversable</strong> trait (<code>ChildOf</code> and <code>IsA</code> have it out of the box).</li><li>The echo <strong>stops at any entity that owns the component itself</strong>. If a child has its own Position, that child and everything below it hears its own value, not the parent's — so the event isn't propagated past it.</li></ul>"
      },
      {
        type: "diagram",
        heading: "Where the echo stops",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "p", label: "parent", sub: "ecs_set Position here" } ],
            [ { id: "c1", label: "child A", sub: "no Position of its own" },
              { id: "c2", label: "child B", sub: "owns Position" } ],
            [ { id: "g1", label: "grandchild of A", sub: "still hears the event" },
              { id: "g2", label: "grandchild of B", sub: "hears nothing" } ]
          ],
          edges: [
            { from: "p", to: "c1", label: "propagates" },
            { from: "c1", to: "g1", label: "propagates" },
            { from: "p", to: "c2", dashed: true, label: "stops: owns it" },
            { from: "c2", to: "g2", dashed: true }
          ],
          note: "An OnSet on the parent reaches every entity whose up traversal would find the parent's Position."
        }
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "observer that hears Position from self or parent",
        src: "ecs_observer(world, {\n    .query.terms = {{ ecs_id(Position), .src.id = EcsSelf|EcsUp }},\n    .events = { EcsOnSet },\n    .callback = OnSetPosition\n});\n\necs_entity_t parent = ecs_new(world);\necs_entity_t child = ecs_new_w_pair(world, EcsChildOf, parent);\n\necs_set(world, parent, Position, {10, 20});"
      },
      {
        type: "text",
        heading: "Event forwarding: the pull version",
        html: "<p>Propagation pushes an existing event down. <strong>Event forwarding</strong> is the mirror image: when you add a relationship pair like <code>(ChildOf, my_parent)</code> to an entity, Flecs generates fresh <code>OnAdd</code> events for every component the entity can now reach through the parent — as if the child had just gained them. Removing the pair forwards <code>OnRemove</code> events the same way.</p><p>Together they make code order-independent: it doesn't matter whether the parent got its components before or after the child attached to it. Only <em>reachable</em> components are forwarded — if both parent and grandparent have Position, only the parent's counts. <code>OnSet</code> forwarding is reserved for <code>IsA</code> pairs, so instantiating a prefab announces the values of all inherited components.</p>"
      }
    ],
    related: ["evt-observers", "evt-builtin-events", "components", "lif-prefabs"]
  },
  {
    id: "evt-monitors",
    parent: "events",
    order: 5,
    title: "Monitors",
    code: "EVT-09",
    tagline: "Fire when an entity enters or leaves a club",
    intro: "A monitor is an observer that watches membership, not individual changes: it fires once when an entity <em>starts</em> matching its query, and once when it <em>stops</em>. You create one by subscribing to the special <code>EcsMonitor</code> event.",
    sections: [
      {
        type: "text",
        heading: "Crossing the threshold",
        html: "<p>Think of the query as a club with entry rules — &quot;has Position and a parent&quot;. A regular observer would ping you on every rule-related event. A monitor only cares about the doorway: it invokes your callback with an <code>OnAdd</code> event when an entity walks in (starts matching), and with an <code>OnRemove</code> event when it walks out (stops matching). Changes that keep the entity inside the club — like swapping one parent for another — are silent.</p><p>A monitor observer can only specify the single <code>EcsMonitor</code> event; you can't mix it with other events.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "watch entities enter and leave a query",
        src: "void MyMonitor(ecs_iter_t *it) {\n    if (it->event == EcsOnAdd) {\n        printf(\"started matching\\n\");\n    } else if (it->event == EcsOnRemove) {\n        printf(\"stopped matching\\n\");\n    }\n}\n\necs_observer(world, {\n    .query.terms = {\n        { ecs_id(Position) },\n        { ecs_pair(EcsChildOf, EcsWildcard) }\n    },\n    .events = { EcsMonitor },\n    .callback = MyMonitor\n});"
      },
      {
        type: "diagram",
        heading: "When the callback runs",
        spec: {
          type: "grid",
          title: "Matched before the change vs. after",
          cols: ["Before", "After", "Callback invoked with"],
          rows: [
            ["No", "No", "-"],
            ["No", "Yes", "OnAdd"],
            ["Yes", "Yes", "-"],
            ["Yes", "No", "OnRemove"]
          ],
          note: "Flecs evaluates the query against the entity's previous and current archetype and compares the answers."
        }
      },
      {
        type: "text",
        heading: "Cost",
        html: "<p>That before-and-after comparison is exactly how monitors are implemented: the query is evaluated twice per relevant event, once against the entity's previous set of components and once against the current one. That makes monitors more expensive than regular observers — use them when you genuinely need the enter/leave semantics.</p>"
      }
    ],
    related: ["evt-observers", "evt-observer-matching", "queries"]
  },
  {
    id: "lif-prefabs",
    parent: "lifecycle",
    order: 1,
    title: "Prefabs",
    code: "LIF-01",
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
    related: ["lif-inheritance", "lif-prefab-hierarchies", "queries", "script"]
  },
  {
    id: "lif-inheritance",
    parent: "lif-prefabs",
    order: 1,
    title: "Inheritance & Overrides",
    code: "LIF-02",
    tagline: "Copy it, share it, or keep it to yourself",
    intro: "What happens to each component when a prefab is instantiated is decided by its <code>OnInstantiate</code> trait: <em>Override</em> copies the value onto the instance, <em>Inherit</em> shares one value across all instances, and <em>DontInherit</em> keeps it on the prefab only.",
    sections: [
      {
        type: "text",
        heading: "The three behaviors",
        html: "<p>The trait is a pair you add to the <em>component</em>, like <code>(OnInstantiate, Inherit)</code>:</p><ul><li><strong>Override (the default).</strong> The value is copied from prefab to instance at instantiation. Each instance owns its copy from the start. The component must be copyable.</li><li><strong>Inherit.</strong> The value stays on the prefab, stored once in memory, and instances <em>share</em> it. <code>ecs_get</code>, <code>ecs_has</code> and queries automatically follow the <code>IsA</code> relationship to find it. Perfect for static data like meshes, materials, or base stats.</li><li><strong>DontInherit.</strong> Instances neither copy nor see the component. <code>has</code> and <code>get</code> return nothing, and it can't be overridden manually.</li></ul><p>Use <code>ecs_owns</code> to ask whether an instance has its own copy, and <code>ecs_target_for</code> to find which base entity a component is inherited from.</p>"
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
        title: "inherit, override, un-override",
        src: "ecs_add_pair(world, ecs_id(Defense), EcsOnInstantiate, EcsInherit);\n\necs_entity_t SpaceShip = ecs_entity(world, {\n    .name = \"SpaceShip\",\n    .add = ecs_ids( EcsPrefab )\n});\necs_set(world, SpaceShip, Defense, {50});\n\necs_entity_t inst = ecs_new_w_pair(world, EcsIsA, SpaceShip);\n\necs_add(world, inst, Defense);\n\necs_set(world, inst, Defense, {75});\n\necs_remove(world, inst, Defense);"
      },
      {
        type: "text",
        heading: "Overriding, and forcing it",
        html: "<p>An inherited component becomes owned the moment you add or set it on the instance — that's an <em>override</em>. A plain <code>add</code> initializes the override with the prefab's current value, so you can tweak from there. Removing the override re-exposes the shared prefab value (and fires an <code>OnSet</code> event, since the effective value changed).</p><p>Sometimes a component should be inheritable in general, but one particular prefab wants every instance to own it. That's an <strong>auto override</strong>: <code>ecs_auto_override(world, SpaceShip, Defense)</code> flags the component on the prefab so instantiation always copies it. Auto overrides even work for components the prefab doesn't have — the instance just gets a default-constructed one.</p><p>Prefabs can also inherit from each other with <code>IsA</code> to build <strong>variants</strong>: a Freighter prefab that is-a SpaceShip overrides Health to 150 and inherits everything else. Instances of the variant get the most specific value.</p>"
      }
    ],
    related: ["lif-prefabs", "lif-prefab-hierarchies", "components", "evt-builtin-events"]
  },
  {
    id: "lif-prefab-hierarchies",
    parent: "lif-prefabs",
    order: 2,
    title: "Hierarchies & Slots",
    code: "LIF-03",
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
    related: ["lif-prefabs", "lif-inheritance", "world"]
  },
  {
    id: "lif-cleanup",
    parent: "lifecycle",
    order: 2,
    title: "Cleanup Policies",
    code: "LIF-04",
    tagline: "No dangling references, ever — you just choose how",
    intro: "Entities are used <em>inside</em> other entities: as tags, components, and halves of relationship pairs. So what happens when you delete one? Cleanup traits answer that per relationship — remove the references, delete the entities holding them, or refuse with a panic — and Flecs guarantees no dangling references survive.",
    sections: [
      {
        type: "text",
        heading: "The librarian's problem",
        html: "<p>Imagine a library card that thousands of books reference. If the card is destroyed, something must happen to every book pointing at it — otherwise the catalog lies. When you delete an entity that others use, Flecs must clean up:</p><ul><li>every entity that <em>has</em> it (as a tag or component),</li><li>every pair using it as the relationship: <code>(Archer, *)</code>,</li><li>every pair using it as the target: <code>(*, Archer)</code>.</li></ul><p>The <em>how</em> is configured with a <code>(Condition, Action)</code> pair on the entity being deleted. Two conditions: <code>OnDelete</code> (this thing itself is deleted) and <code>OnDeleteTarget</code> (an entity used as the <em>target</em> of this relationship is deleted). Three actions:</p><ul><li><strong>Remove</strong> — strip the references from everyone (the default for tags and relationships).</li><li><strong>Delete</strong> — delete every entity holding a reference.</li><li><strong>Panic</strong> — abort with a fatal error (the default for components: deleting a component type out from under live entities is usually a bug).</li></ul><p>This only covers ids <em>added to</em> entities. An <code>ecs_entity_t</code> stored inside your own component struct is invisible to cleanup traits.</p>"
      },
      {
        type: "text",
        heading: "Why deleting a parent deletes the children",
        html: "<p>The builtin <code>ChildOf</code> relationship ships with <code>(OnDeleteTarget, Delete)</code>: &quot;when the target of a ChildOf pair (the parent) is deleted, delete the entities that have the pair (the children)&quot;. That single trait is the entire reason hierarchies clean themselves up.</p><p>You can give your own relationships the same behavior — a <code>Requires</code> relationship where dependents die with their dependency — or the opposite: leave the default so deleting a target merely removes the pairs.</p>"
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "a relationship whose holders die with the target",
        src: "ecs_entity_t Requires = ecs_new(world);\necs_add_pair(world, Requires, EcsOnDeleteTarget, EcsDelete);\n\necs_entity_t reactor = ecs_new(world);\necs_entity_t shield = ecs_new_w_pair(world, Requires, reactor);\n\necs_delete(world, reactor);\n\necs_is_alive(world, shield);"
      },
      {
        type: "diagram",
        heading: "One delete, cascading",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "del", label: "ecs_delete(world, parent)" } ],
            [ { id: "pol", label: "ChildOf: (OnDeleteTarget, Delete)", sub: "policy lookup" } ],
            [ { id: "c1", label: "delete child 1", sub: "OnRemove observers fire" },
              { id: "c2", label: "delete child 2" } ],
            [ { id: "g", label: "delete grandchildren", sub: "same policy, recursively" },
              { id: "done", label: "delete parent last", sub: "children first, then parent" } ]
          ],
          edges: [
            { from: "del", to: "pol" },
            { from: "pol", to: "c1" },
            { from: "pol", to: "c2" },
            { from: "c1", to: "g" },
            { from: "c2", to: "done" }
          ],
          note: "Each deleted child re-runs the same machinery for its own children, so the whole subtree unwinds bottom-up."
        }
      }
    ],
    related: ["lif-world-teardown", "evt-observer-execution", "components", "world"]
  },
  {
    id: "lif-world-teardown",
    parent: "lif-cleanup",
    order: 1,
    title: "Cleanup Order & Teardown",
    code: "LIF-05",
    tagline: "What can you rely on when everything is being demolished",
    intro: "Cleanup traits say <em>what</em> must happen, not in <em>which order</em> — many orders satisfy them. That matters most for <code>OnRemove</code> observers, and most of all during world teardown, when everything is deleted at once.",
    sections: [
      {
        type: "text",
        heading: "The one guarantee, and its limits",
        html: "<p>When you delete a parent, its children are cleaned up first — so an <code>OnRemove</code> observer sees children before parents. This holds for any relationship with <code>(OnDeleteTarget, Delete)</code>, as long as the graph of deleted entities has no cycles.</p><p>It stops holding when the deletion comes from a different direction. Delete the <em>component</em> <code>Node</code> instead of the parent, and every entity with Node is cleaned up without consulting <code>ChildOf</code> policies — order undefined. Cycles between relationships with Delete actions also make order undefined.</p>"
      },
      {
        type: "diagram",
        heading: "What ecs_fini does",
        spec: {
          type: "stack",
          layers: [
            { label: "1. Find all root entities", sub: "entities without a ChildOf pair" },
            { label: "2. Set aside modules, components, observers, systems", sub: "they must outlive their users" },
            { label: "3. Set aside childless entities", sub: "they can't trigger complex cleanup" },
            { label: "4. Delete the remaining roots", sub: "cleanup traits respected" },
            { label: "5. Delete everything else", sub: "traits no longer considered, order undefined" }
          ],
          note: "The further down the list an entity is deleted, the fewer guarantees it gets."
        }
      },
      {
        type: "text",
        heading: "Organizing for a graceful shutdown",
        html: "<p>Because step 2 protects modules, where you put things decides how they die:</p><ul><li><strong>Put components, observers and systems in modules.</strong> They'll survive until the entities that use them are gone, so observers aren't deleted while events they'd match are still being generated.</li><li><strong>Don't park them under ordinary entities.</strong> A non-module scope in the root gets torn down with the regular entities. If you have such a scope, add the <code>EcsModule</code> tag to its root.</li></ul>"
      }
    ],
    related: ["lif-cleanup", "evt-observer-execution", "world", "systems"]
  },
  {
    id: "lif-deferring",
    parent: "lifecycle",
    order: 3,
    title: "Deferring & Commands",
    code: "LIF-06",
    tagline: "Don't rebuild the plane mid-flight — take notes, act later",
    intro: "Adding or removing components moves entities between tables — the very arrays a system might be iterating. So while iterating, Flecs doesn't perform your operations; it writes them down as <em>commands</em> and replays them when it's safe. That's deferring.",
    sections: [
      {
        type: "text",
        heading: "The notepad",
        html: "<p>Between <code>ecs_defer_begin</code> and <code>ecs_defer_end</code>, structural operations — <code>add</code>, <code>remove</code>, <code>set</code>, <code>delete</code> and friends — are recorded instead of executed. At <code>ecs_defer_end</code> the notepad is replayed against the real storage, and that is also when observers fire, since that's when the changes actually happen.</p><p>You rarely call these yourself: systems run with deferring already on. The important part is understanding the consequences — until the flush, <code>ecs_has</code> won't see your deferred add, because it hasn't happened yet.</p>"
      },
      {
        type: "diagram",
        heading: "Write now, apply later",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "sys", label: "Your code", sub: "inside defer_begin/end" } ],
            [ { id: "q", label: "Command queue", sub: "add, set, delete... recorded" } ],
            [ { id: "end", label: "ecs_defer_end", sub: "or a pipeline sync point" } ],
            [ { id: "tab", label: "Tables updated", sub: "entities move, values written" },
              { id: "obs", label: "Observers & hooks fire", sub: "changes are now real" } ]
          ],
          edges: [
            { from: "sys", to: "q" },
            { from: "q", to: "end" },
            { from: "end", to: "tab" },
            { from: "tab", to: "obs" }
          ]
        }
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "nothing is visible until the end",
        src: "ecs_defer_begin(world);\n\necs_entity_t e = ecs_new(world);\necs_add(world, e, Position);\necs_set(world, e, Velocity, {1, 1});\n\necs_has(world, e, Position);\n\necs_defer_end(world);\n\necs_has(world, e, Position);"
      },
      {
        type: "text",
        heading: "Rules of the notepad",
        html: "<p>A few behaviors to keep in mind while deferred:</p><ul><li><strong>Entity ids are real immediately.</strong> Creating an entity hands out a fresh id right away — only its components wait.</li><li><strong><code>ecs_ensure</code> reads the present.</strong> It returns a pointer initialized from the <em>current</em> value, ignoring deferred set operations still in the queue.</li><li><strong>Operations on deleted entities evaporate.</strong> If an entity is deleted while deferred, later commands for it are ignored at <code>ecs_defer_end</code>.</li><li><strong>Orphans are cleaned up.</strong> A child created for a parent that got deleted while deferred is itself deleted at the flush.</li><li><strong>You can pause.</strong> <code>ecs_defer_suspend</code> / <code>ecs_defer_resume</code> temporarily execute operations immediately without ending the defer block, and <code>ecs_is_deferred</code> tells you the current mode.</li></ul>"
      }
    ],
    related: ["lif-command-batching", "lif-staging", "evt-observer-execution", "internals"]
  },
  {
    id: "lif-command-batching",
    parent: "lif-deferring",
    order: 1,
    title: "Command Batching",
    code: "LIF-07",
    tagline: "Ten notes, one move",
    intro: "When the command queue is flushed, Flecs doesn't replay your operations one by one. Commands for the same entity are linked together and combined, so an entity that had five components added moves between tables <em>once</em>, not five times.",
    sections: [
      {
        type: "text",
        heading: "Combining the notes",
        html: "<p>Moving an entity to a different table is the expensive part of structural changes: every component it has gets copied over. Without batching, adding five components would mean five moves, copying almost everything five times. With batching, Flecs walks all queued commands for an entity, computes the <em>final</em> table, and performs a single move.</p><p>Conflicting commands simply cancel out in that computation: an <code>add</code> followed by a <code>remove</code> of the same component nets to nothing; <code>clear</code> wipes the slate; commands recorded after a <code>delete</code> aren't applied at all. If the target of a queued pair died in the meantime, the pair is dropped — or, if it carried a <code>Delete</code> cleanup policy, the whole entity is deleted at the flush.</p>"
      },
      {
        type: "diagram",
        heading: "Queue in, net effect out",
        spec: {
          type: "grid",
          title: "Commands queued for entity e",
          cols: ["#", "Command", "Effect on final table"],
          rows: [
            ["1", "add Position", "+Position"],
            ["2", "set Velocity {1, 2}", "+Velocity, value written after the move"],
            ["3", "add Turret", "+Turret"],
            ["4", "remove Turret", "cancels #3"],
            ["5", "add (ChildOf, parent)", "+pair, dropped if parent died"]
          ],
          note: "Result: one move to table [Position, Velocity, (ChildOf, parent)], then values and events."
        }
      },
      {
        type: "text",
        heading: "What batching costs you",
        html: "<p>Batching is why some event orderings are undefined: <code>OnAdd</code> and <code>OnRemove</code> events for one entity may fire in a different order than the operations were issued, and ordering across entities isn't guaranteed either. <code>OnSet</code> and custom event order <em>is</em> preserved.</p><p>It's also why abusing add/remove as a signaling mechanism is unreliable: an add that is cancelled by a later remove in the same batch never really happens, so observers may never see it. If you need a guaranteed message, use a custom event.</p>"
      }
    ],
    related: ["lif-deferring", "evt-observer-execution", "evt-custom-events", "internals"]
  },
  {
    id: "lif-staging",
    parent: "lifecycle",
    order: 4,
    title: "Staging",
    code: "LIF-08",
    tagline: "One read-only world, a private notepad per thread",
    intro: "During <code>ecs_progress</code> the world flips into a readonly state: systems may read and write component values, but every structural operation becomes a command. Each thread records its commands into its own <em>stage</em>, so many threads can work on one world without locks.",
    sections: [
      {
        type: "text",
        heading: "Why the world goes readonly",
        html: "<p>If a system could restructure storage mid-iteration, the component arrays under every other system's feet could be reallocated — a crash waiting to happen. So <code>ecs_progress</code> wraps the frame in readonly mode: iterating and writing component values is fine, but calling <code>add</code>/<code>remove</code>/<code>set</code> on the world itself asserts. Operations go through a stage instead, where they're deferred automatically.</p><p>A stage is a thin handle that behaves like an <code>ecs_world_t</code> — you pass it to the same functions — but records commands into its own queue. With one stage per thread, threads never contend: everyone reads the shared world, everyone writes to a private notepad.</p>"
      },
      {
        type: "diagram",
        heading: "Fan out, merge back",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "w1", label: "World (readonly)", sub: "shared, safe to iterate" } ],
            [ { id: "s0", label: "Stage 0", sub: "thread 0 commands" },
              { id: "s1", label: "Stage 1", sub: "thread 1 commands" },
              { id: "s2", label: "Stage 2", sub: "thread 2 commands" } ],
            [ { id: "m", label: "Merge", sub: "ecs_readonly_end / sync point" } ],
            [ { id: "w2", label: "World (writable)", sub: "all commands applied" } ]
          ],
          edges: [
            { from: "w1", to: "s0" },
            { from: "w1", to: "s1" },
            { from: "w1", to: "s2" },
            { from: "s0", to: "m" },
            { from: "s1", to: "m" },
            { from: "s2", to: "m" },
            { from: "m", to: "w2" }
          ],
          note: "Threads read one shared world and write to private queues; the merge replays every queue."
        }
      },
      {
        type: "code",
        heading: "Try it",
        lang: "c",
        title: "manual staging, without the pipeline",
        src: "ecs_set_stage_count(world, 2);\necs_world_t *stage = ecs_get_stage(world, 1);\n\necs_readonly_begin(world, false);\n\necs_add(stage, e, Tag);\n\necs_readonly_end(world);"
      },
      {
        type: "text",
        heading: "Merges and escape hatches",
        html: "<p>The pipeline manages all of this for you: <code>ecs_progress</code> calls <code>ecs_readonly_begin</code>, hands each thread its stage, and merges at <code>ecs_readonly_end</code>. Merges can also happen mid-frame at <strong>sync points</strong>, which the pipeline inserts by watching what systems read and write: when a system reads a component that an earlier system declared it writes (via an <code>out</code> term on an empty source, or <code>.write()</code> in C++), a sync point flushes the queues in between, so the reader sees the changes.</p><p>When commands won't do, mark a system as <strong>immediate</strong>: it runs outside readonly mode, single-threaded, and its operations take effect at once — except on the entities it is currently iterating, which must still be deferred. Manual control exists too: <code>ecs_set_stage_count</code>, <code>ecs_get_stage</code>, <code>ecs_readonly_begin</code>/<code>ecs_readonly_end</code>, <code>ecs_merge</code>, and <code>ecs_stage_new</code>/<code>ecs_stage_free</code> for standalone command queues.</p>"
      }
    ],
    related: ["lif-deferring", "lif-command-batching", "systems", "internals"]
  }
]);
