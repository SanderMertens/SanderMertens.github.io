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
    related: ["evt-observers", "evt-table-events", "components", "lif-prefabs", "cmp-hooks"]
  },
  {
    id: "evt-table-events",
    parent: "evt-builtin-events",
    order: 1,
    title: "Table Events",
    code: "EVT-01A",
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
    code: "EVT-02",
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
        heading: "Which shape do you need?",
        html: "<p>Every observer is the same three parts, but what you put in them changes both what fires and what it costs:</p><ul><li>One term is the cheap case: the event already names the id, so there is nothing left to evaluate.</li><li>Several terms mean the observer only fires when the entity matches the whole query — the way to react to an entity <em>becoming</em> something.</li><li>Several events share one callback, which is how you keep \"added\" and \"removed\" logic in one place.</li><li><code>yield_existing</code> makes the observer see entities that already matched before it existed, so setup order stops mattering.</li></ul>"
      }
    ],
    related: ["evt-monitors", "cmp-hooks", "systems", "scr-refs"]
  },
  {
    id: "evt-single-term",
    parent: "evt-observers",
    order: 1,
    title: "Single-Term Observers",
    code: "EVT-02A",
    tagline: "One component, one event, no query to evaluate",
    intro: "An observer whose query is a single term is the simplest and by far the cheapest kind. The event already says which id it is about, so there is nothing left to check: if the ids line up, your callback runs. This is the shape you should reach for first.",
    sections: [
      {
        type: "text",
        heading: "A doorbell wired to one door",
        html: "<p>A single-term observer is a doorbell with one wire. When something happens to <code>Position</code> on any entity, the bell rings. Flecs does not have to ask any follow-up questions — the event carries the id it is about, and that id is the whole query.</p><p>The saving is real. For a multi-term observer, Flecs must evaluate the full query against the entity before deciding whether to call you. A single-term observer skips that step entirely, so it costs little more than a function call on top of the operation that triggered it.</p>"
      },
      {
        type: "code",
        heading: "One term, one event",
        lang: "c",
        title: "React whenever Position is set on anything",
        src: "void OnSetPosition(ecs_iter_t *it) {\n    Position *p = ecs_field(it, Position, 0);\n\n    for (int i = 0; i < it->count; i ++) {\n        printf(\"%s moved to {%f, %f}\\n\",\n            ecs_get_name(it->world, it->entities[i]),\n            (double)p[i].x, (double)p[i].y);\n    }\n}\n\necs_observer(world, {\n    .query.terms = {{ ecs_id(Position) }},\n    .events = { EcsOnSet },\n    .callback = OnSetPosition\n});"
      },
      {
        type: "text",
        heading: "What the callback gets",
        html: "<p>Even though an event is about one entity's change, the callback receives an iterator, exactly like a system. That is deliberate: it keeps the two APIs interchangeable, and it lets Flecs hand you several entities at once when it can — for instance when a whole table's worth of entities is affected, or when the observer is catching up on entities that already existed.</p><ul><li><code>it->count</code> — how many entities this invocation covers. Often 1, not always.</li><li><code>it->entities</code> — the entities the event is about.</li><li><code>it->event</code> — which event fired, useful when the observer listens to more than one.</li><li><code>it->event_id</code> — the exact id the event was for, which matters when the term is a wildcard like <code>(Likes, *)</code>.</li><li><code>ecs_field</code> — the component data, if the event carries any. <code>OnRemove</code> still gives you the value, one last time, before it is gone.</li></ul>"
      },
      {
        type: "text",
        heading: "Terms that are still \"single\"",
        html: "<p>A single term does not have to be a plain component:</p><ul><li>A <strong>tag</strong> works the same way, minus the data.</li><li>A <strong>pair</strong> like <code>(Likes, Alice)</code> observes exactly that relationship.</li><li>A <strong>wildcard</strong> pair like <code>(Likes, *)</code> fires for any target, with <code>it->event_id</code> telling you which one.</li></ul><p>What takes an observer off this fast path is a second term, an operator, or traversal — anything that means the event alone is not enough to decide whether you should be called.</p>"
      }
    ],
    related: ["evt-multi-term", "evt-builtin-events", "cmp-hooks"]
  },
  {
    id: "evt-multi-term",
    parent: "evt-observers",
    order: 2,
    title: "Multi-Term Observers",
    code: "EVT-02B",
    tagline: "Fire only when the entity matches the whole query",
    intro: "An observer's query can have more than one term — \"Position <em>and</em> Velocity\" — and then it only fires when the entity satisfies all of them. Adding Position does nothing; adding Velocity to that same entity completes the match, and the callback runs.",
    sections: [
      {
        type: "text",
        heading: "The last piece of the puzzle",
        html: "<p>A multi-term observer is a tripwire that only counts when every condition is true at once. It is how you react to an entity <em>becoming</em> something: gaining the last component that makes it a moving object, a rendered object, a valid target.</p><p>Because an observer's query is a real query, everything queries can express is available here: multiple terms, <code>Not</code> and <code>Optional</code> operators, traversal, and query variables. The cost is that Flecs can no longer decide from the event alone whether to call you.</p>"
      },
      {
        type: "text",
        heading: "How it fires",
        html: "<p>Under the hood, a multi-term observer is built from several single-term observers — one tripwire per term. When any one of them trips, Flecs evaluates the <em>full</em> query against the entity that caused the event, and invokes your callback only if everything matches.</p><p>That means the observer fires on an event for <em>any</em> of its terms, as long as the whole query matches at that moment. Set Position on an entity that already has Velocity: it fires. Set Velocity on it: it fires again. If that is not what you want, mark the terms you do not want to trigger on as filter terms.</p>"
      },
      {
        type: "diagram",
        heading: "Event, then query, then callback",
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
          note: "Single-term observers skip the query evaluation step, which is what makes them cheaper."
        }
      },
      {
        type: "code",
        heading: "Two terms, and a filter",
        lang: "c",
        title: "Only trigger on Position, but require Velocity",
        src: "ecs_observer(world, {\n    .query.terms = {\n        { ecs_id(Position) },\n        { ecs_id(Velocity) }\n    },\n    .events = { EcsOnAdd },\n    .callback = OnMovable\n});\n\necs_observer(world, {\n    .query.terms = {\n        { ecs_id(Position) },\n        { ecs_id(Velocity), .inout = EcsInOutFilter }\n    },\n    .events = { EcsOnSet },\n    .callback = OnPositionOnly\n});"
      },
      {
        type: "text",
        heading: "Things that bite",
        html: "<ul><li><strong>It can fire more than once for one entity.</strong> Any term's event re-triggers the check. If you need \"tell me once when this entity starts matching, and once when it stops\", you want a monitor.</li><li><strong>Order of operations matters.</strong> The observer fires when the query becomes true, which is when the <em>last</em> missing piece arrives. Batched commands can change which operation that is.</li><li><strong>Fields you did not trigger on are still readable.</strong> The iterator gives you every term's data, not just the one the event was about.</li><li><strong>Tags in an OnSet observer</strong> get their event downgraded to <code>OnAdd</code>, since a tag has no value to set.</li></ul>"
      }
    ],
    related: ["evt-single-term", "evt-observer-matching", "evt-monitors", "qry-operators"]
  },
  {
    id: "evt-multi-event",
    parent: "evt-observers",
    order: 3,
    title: "Multi-Event Observers",
    code: "EVT-02C",
    tagline: "One callback for add, set and remove",
    intro: "An observer subscribes to a list of events, not just one. Listing <code>OnAdd</code> and <code>OnRemove</code> together gives you a single callback that sees an entity arrive and leave — usually much easier to keep correct than two callbacks that have to agree with each other.",
    sections: [
      {
        type: "text",
        heading: "One guest book for arrivals and departures",
        html: "<p>If you keep a side table of \"everything currently rendered\", you need to add on arrival and erase on departure. Two separate observers means two places to keep in sync. One observer listening to both events keeps that logic in one function, where the two halves sit next to each other.</p><p>Inside the callback, <code>it->event</code> tells you which event you are handling. Everything else — the entity list, the fields — works the same regardless.</p>"
      },
      {
        type: "code",
        heading: "Two events, one callback",
        lang: "c",
        title: "Keep an external index in step with the world",
        src: "void OnRenderable(ecs_iter_t *it) {\n    for (int i = 0; i < it->count; i ++) {\n        if (it->event == EcsOnAdd) {\n            index_insert(it->entities[i]);\n        } else if (it->event == EcsOnRemove) {\n            index_erase(it->entities[i]);\n        }\n    }\n}\n\necs_observer(world, {\n    .query.terms = {{ ecs_id(Mesh) }},\n    .events = { EcsOnAdd, EcsOnRemove },\n    .callback = OnRenderable\n});"
      },
      {
        type: "text",
        heading: "The rules",
        html: "<ul><li>The <code>events</code> array holds up to eight events. They can be builtin events, your own custom event entities, or a mix.</li><li>The observer is registered once per event, so listening to three events costs roughly three single-event registrations — the callback is what gets shared, not the matching work.</li><li>Listing <code>EcsWildcard</code> as the event subscribes to <em>everything</em> that matches the query. That is a debugging tool: it is expensive, and it will surprise you with events you did not know existed.</li><li>When an <code>OnSet</code> observer has terms for tags, those terms' events are quietly downgraded to <code>OnAdd</code>, because a tag has no value that could be set. This is what lets you mix components and tags in one <code>OnSet</code> observer instead of the observer failing to be created.</li></ul>"
      },
      {
        type: "text",
        heading: "Add and remove are not symmetrical",
        html: "<p>The two ends of an entity's life look similar but are not mirror images, and a combined observer is where that shows up:</p><ul><li>On <code>OnAdd</code> for a component with data, the value has been constructed but not necessarily assigned yet — that is what <code>OnSet</code> is for.</li><li>On <code>OnRemove</code>, the value is still readable. This is your last chance to release anything the component owns.</li><li>Removal can come from an explicit remove, from the entity being deleted, or from the whole world being torn down. Your callback should not assume the entity still exists afterwards.</li></ul>"
      }
    ],
    related: ["evt-builtin-events", "evt-custom-events", "evt-yield-existing"]
  },
  {
    id: "evt-yield-existing",
    parent: "evt-observers",
    order: 4,
    title: "Yield Existing",
    code: "EVT-02D",
    tagline: "Catch up on everything that already matched",
    intro: "An observer normally only sees what happens after it is created — which makes your code depend on the order in which things are set up. Set <code>yield_existing</code> and the observer is first invoked for every entity that <em>already</em> matches, as if those events had just happened.",
    sections: [
      {
        type: "text",
        heading: "Arriving late to the party",
        html: "<p>Imagine hiring a doorman halfway through the evening. He will greet everyone who arrives from now on, but the room is already full of people he never saw come in. <code>yield_existing</code> walks him around the room once, introducing him to everyone already there.</p><p>This is what makes observer code order-independent. Whether your scene was loaded before or after the observer was registered, the observer ends up having seen every entity exactly once.</p>"
      },
      {
        type: "code",
        heading: "Catching up on creation",
        lang: "c",
        title: "e1 exists before the observer and still triggers it",
        src: "ecs_entity_t e1 = ecs_insert(world, ecs_value(Position, {10, 20}));\n\necs_observer(world, {\n    .query.terms = {{ ecs_id(Position) }},\n    .events = { EcsOnAdd },\n    .callback = OnPosition,\n    .yield_existing = true\n});\n\necs_entity_t e2 = ecs_insert(world, ecs_value(Position, {30, 40}));"
      },
      {
        type: "text",
        heading: "When it runs, and for which events",
        html: "<p>Yielding happens once, at observer creation, before the function that created it returns. It works with <code>OnAdd</code>, <code>OnSet</code> and <code>OnRemove</code> — the three events that describe a state an entity can already be in. Custom events are not yielded, because there is no way to know what \"already happened\" would mean for them.</p><p>The catch-up pass runs the observer's query, so your callback is invoked per matched table with the usual iterator. That means it is likely to be called with many entities at once, unlike the one-at-a-time invocations a real event usually produces. Write the callback as a loop over <code>it->count</code> and both cases work.</p>"
      },
      {
        type: "text",
        heading: "Yield on delete, too",
        html: "<p>The mirror image is just as useful: when an observer goes away, run it once more for everything that still matches, so it can clean up. Two flags on <code>flags_</code> in the observer descriptor pick which ends you want:</p><ul><li><code>EcsObserverYieldOnCreate</code> — yield when the observer is created. This is what <code>yield_existing</code> turns on.</li><li><code>EcsObserverYieldOnDelete</code> — yield when the observer is deleted.</li></ul><p>Set the flags directly when you want only one of the two; do not combine them with <code>yield_existing</code> at the same time. A common pairing is <code>OnAdd</code> with yield-on-create and <code>OnRemove</code> with yield-on-delete, which gives an external index that is correct no matter when the observer is created or destroyed.</p>"
      }
    ],
    related: ["evt-multi-event", "evt-observer-execution", "evt-monitors"]
  },
  {
    id: "evt-observer-matching",
    parent: "evt-observers",
    order: 5,
    title: "Matching Details",
    code: "EVT-02E",
    tagline: "Filter terms, inverted events, and fixed sources",
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
        heading: "Fixed sources",
        html: "<p>A term can be matched on one <em>named</em> entity instead of on whatever the event is about, by setting the term's source: <code>{ ecs_id(TimeOfDay), .src.id = Game }</code>. Setting <code>TimeOfDay</code> on <code>Game</code> then fires the observer, and setting it on any other entity does not — a tidy way to watch a single config or singleton entity.</p><p>Mixing matters here. If <em>every</em> term has a fixed source, events are matched for each of them, as you would expect. But as soon as an observer mixes <code>$this</code> terms with fixed-source terms, the fixed-source terms stop producing events and only act as conditions — otherwise one event on the fixed entity would mean iterating every entity matching <code>$this</code>.</p>"
      }
    ],
    related: ["evt-yield-existing", "evt-observers", "evt-observer-execution", "qry-sources"]
  },
  {
    id: "evt-observer-execution",
    parent: "evt-observers",
    order: 6,
    title: "When Observers Run",
    code: "EVT-02F",
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
    related: ["evt-observers", "lif-deferring", "systems", "cmp-cleanup-traits"]
  },
  {
    id: "evt-custom-events",
    parent: "events",
    order: 3,
    title: "Custom Events & emit",
    code: "EVT-03",
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
    code: "EVT-03A",
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
    title: "Event Propagation & Forwarding",
    code: "EVT-04",
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
    related: ["evt-observers", "evt-builtin-events", "components", "lif-prefabs", "wld-hierarchies", "qry-traversal"]
  },
  {
    id: "evt-monitors",
    parent: "events",
    order: 5,
    title: "Monitors",
    code: "EVT-05",
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
    related: ["evt-observers", "evt-observer-matching", "queries", "sto-dont-fragment"]
  }
]);
