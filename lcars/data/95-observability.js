window.FLECS_TOUR.register([
  {
    id: "obs-statistics",
    parent: "observability",
    order: 1,
    title: "Statistics",
    code: "OBS-01",
    tagline: "A flight recorder that samples the world every frame",
    intro: "The stats addon is Flecs watching itself. It measures things like how many entities exist, how long each frame took, and how many commands ran — and when you import the <code>FlecsStats</code> module, it keeps those measurements automatically, frame by frame, so tools like the Flecs Explorer can draw them as live charts.",
    sections: [
      {
        type: "text",
        heading: "Two ways to use it",
        html: "<p>Think of a car dashboard. You can glance at the speedometer yourself whenever you like, or you can install a trip computer that records everything continuously.</p><ul><li><strong>Direct API:</strong> call <code>ecs_world_stats_get()</code>, <code>ecs_system_stats_get()</code>, or <code>ecs_pipeline_stats_get()</code> yourself whenever you want a snapshot.</li><li><strong>The FlecsStats module:</strong> import it once and a set of monitor systems samples everything for you, every frame, and stores the results as components on the world entity. This is what the Explorer needs for its performance charts.</li></ul>"
      },
      {
        type: "code",
        heading: "Turning it on",
        lang: "c",
        src: "ECS_IMPORT(world, FlecsStats);\n\necs_world_stats_t stats = {0};\necs_world_stats_get(world, &stats);\necs_world_stats_log(world, &stats);"
      },
      {
        type: "diagram",
        heading: "How samples reach the Explorer",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "w", label: "World activity", sub: "entities, systems, commands" } ],
            [ { id: "m", label: "Monitor systems", sub: "run in EcsPreFrame" } ],
            [ { id: "c", label: "Stat components", sub: "(EcsWorldStats, EcsPeriod1s) on the world entity" } ],
            [ { id: "e", label: "REST API / Explorer", sub: "charts per period" } ]
          ],
          edges: [
            { from: "w", to: "m", label: "measured" },
            { from: "m", to: "c", label: "stored" },
            { from: "c", to: "e", label: "served" }
          ],
          note: "The module stores statistics as pairs like (EcsWorldStats, EcsPeriod1s) on the built-in EcsWorld entity, one pair per time window."
        }
      },
      {
        type: "text",
        heading: "Gauges and counters",
        html: "<p>Every measurement is one of two shapes:</p><ul><li>A <strong>gauge</strong> (<code>ecs_gauge_t</code>) is a &quot;right now&quot; value, like the number of entities. It keeps three arrays of 60 samples each: the windowed <em>average</em>, <em>minimum</em>, and <em>maximum</em> — so a one-frame spike survives even after averaging.</li><li>A <strong>counter</strong> (<code>ecs_counter_t</code>) is a number that only goes up, like total frames processed. It stores the raw values plus a gauge of the <em>rate</em> (how much it grew per interval).</li></ul><p>Both live in 60-slot ring buffers (<code>ECS_STAT_WINDOW</code>), with a cursor <code>t</code> pointing at the most recent slot. The pages below cover how those windows are filled, what the world statistics contain, the lighter-weight world summary, and memory statistics.</p>"
      }
    ],
    related: ["obs-stats-windows", "obs-world-stats", "remote", "systems"]
  },
  {
    id: "obs-stats-windows",
    parent: "obs-statistics",
    order: 1,
    title: "Sampling & Reduce Windows",
    code: "OBS-01A",
    tagline: "Sixty fresh samples per second, folded into minutes, hours, days",
    intro: "The stats module keeps history at several zoom levels at once, like a ship's log with a page for the last second, the last minute, the last hour, and beyond. Each level holds a fixed number of slots, and a slower system periodically folds — <em>reduces</em> — a whole faster window into a single slot of the next one.",
    sections: [
      {
        type: "text",
        heading: "The fastest window: 60 slots per second",
        html: "<p>A system called <code>Monitor1s</code> runs every frame during the <code>EcsPreFrame</code> phase and takes a measurement. Time is divided into slots of 1/60th of a second:</p><ul><li>If several frames land in the <em>same</em> slot (your game runs faster than 60 FPS), their measurements are merged into that slot: averages are combined using a running count, minima and maxima are kept.</li><li>If frames are <em>slower</em> than 60 FPS and slots were skipped, the last measurement is repeated to backfill the gap, so the window never has holes.</li></ul>"
      },
      {
        type: "diagram",
        heading: "The reduce cascade",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "f", label: "Every frame", sub: "one measurement" } ],
            [ { id: "s1", label: "1s window", sub: "60 slots of 1/60s" } ],
            [ { id: "m1", label: "1m window", sub: "60 slots of 1s" } ],
            [ { id: "h1", label: "1h window", sub: "60 slots of 1m" },
              { id: "d1", label: "1d window", sub: "24 aggregated buckets" } ],
            [ { id: "w1", label: "1w window", sub: "168 aggregated buckets" } ]
          ],
          edges: [
            { from: "f", to: "s1", label: "sample" },
            { from: "s1", to: "m1", label: "reduce each second" },
            { from: "m1", to: "h1", label: "reduce each minute" },
            { from: "m1", to: "d1", label: "aggregate" },
            { from: "h1", to: "w1", label: "aggregate" }
          ],
          note: "Reducing a window collapses all its slots into one summary slot of the next window: averages of averages, min of mins, max of maxes."
        }
      },
      {
        type: "text",
        heading: "Who does the folding",
        html: "<p>Each tier is a separate system created by the module: <code>Monitor1m</code> runs on a one-second interval and reduces the whole 1-second window into one slot of the minute window; <code>Monitor1h</code>, <code>Monitor1d</code> and <code>Monitor1w</code> use tick sources to fire less often and fold the tier below them. The day and week tiers use an aggregating variant that keeps folding new data into the current bucket until the bucket's time span (an hour of the day, a chunk of the week) is complete.</p><p>Each tier is stored as its own component pair on the world entity — <code>(EcsWorldStats, EcsPeriod1s)</code> through <code>(EcsWorldStats, EcsPeriod1w)</code> — so the Explorer can chart whichever zoom level you pick. The same machinery is reused for system and pipeline statistics.</p><p><strong>Why min and max matter:</strong> because reducing keeps the minimum and maximum alongside the average, a single terrible 100ms frame is still visible in the hour view — it shows up as a spike in the max line even though the average looks calm.</p>"
      }
    ],
    related: ["obs-world-stats", "systems", "remote"]
  },
  {
    id: "obs-world-stats",
    parent: "obs-statistics",
    order: 2,
    title: "World Statistics",
    code: "OBS-01B",
    tagline: "Every dial on the main dashboard, grouped by subsystem",
    intro: "<code>ecs_world_stats_t</code> is the big one: a struct with dozens of metrics covering everything the world does, organized into named groups. You rarely read all of it — you pick the group you care about, like the frame timings or the command counts.",
    sections: [
      {
        type: "text",
        heading: "The groups, one by one",
        html: "<p>Every member is an <code>ecs_metric_t</code> — a 60-slot gauge or counter window as described on the Statistics page. The groups:</p><ul><li><strong>entities</strong> — how many entities are alive (<code>count</code>) and how many ids are dead but waiting to be recycled (<code>not_alive_count</code>).</li><li><strong>components</strong> — counts of registered ids by kind: <code>tag_count</code> (ids without data), <code>component_count</code> (ids with data), <code>pair_count</code> (relationship pairs), <code>type_count</code>, plus how many ids were created and deleted.</li><li><strong>tables</strong> — how many tables exist (<code>count</code>), how many are empty (<code>empty_count</code>), and table create/delete churn. Lots of churn here often means entities hopping between archetypes.</li><li><strong>queries</strong> — how many queries, observers, and systems exist (<code>query_count</code>, <code>observer_count</code>, <code>system_count</code>).</li><li><strong>commands</strong> — deferred operations by kind: <code>add_count</code>, <code>remove_count</code>, <code>delete_count</code>, <code>clear_count</code>, <code>set_count</code>, <code>ensure_count</code>, <code>modified_count</code>, plus <code>discard_count</code> (commands that turned out to be no-ops, like adding to a deleted entity) and <code>batched_count</code> (commands merged into batches for the same entity).</li><li><strong>frame</strong> — per-frame activity: <code>frame_count</code>, <code>merge_count</code> (command flushes), <code>rematch_count</code> (cached queries revalidating), <code>pipeline_build_count</code>, <code>systems_ran</code>, <code>observers_ran</code>, <code>event_emit_count</code>.</li><li><strong>performance</strong> — the timing dials: <code>fps</code>, <code>delta_time</code>, <code>frame_time</code>, <code>system_time</code>, <code>emit_time</code> (observer notification), <code>merge_time</code>, <code>rematch_time</code>, and world clocks (<code>world_time</code>, <code>world_time_raw</code>).</li><li><strong>memory</strong> — allocation activity per frame: <code>alloc_count</code>, <code>realloc_count</code>, <code>free_count</code>, and <code>outstanding_alloc_count</code> (allocs minus frees — a steadily climbing value hints at a leak), with matching counters for the block and stack allocators.</li><li><strong>http</strong> — request counts for the embedded HTTP server: received, invalid, handled OK, handled with error, not handled, preflight, sends, and how often the server was busy.</li></ul><p>The struct starts and ends with <code>first_</code> / <code>last_</code> markers so tools can iterate all metrics generically, and <code>t</code> is the ring-buffer cursor.</p>"
      },
      {
        type: "code",
        heading: "Reading a value",
        lang: "c",
        src: "ecs_world_stats_t s = {0};\necs_world_stats_get(world, &s);\n\nint32_t t = s.t;\nprintf(\"fps: %.1f\\n\", (double)s.performance.fps.gauge.avg[t]);\nprintf(\"entities: %.0f\\n\", (double)s.entities.count.gauge.avg[t]);\nprintf(\"frames: %.0f\\n\", s.frame.frame_count.counter.value[t]);"
      },
      {
        type: "text",
        heading: "Per-system and per-pipeline stats",
        html: "<p>The same pattern exists at finer grain:</p><ul><li><code>ecs_query_stats_t</code> — per query: <code>result_count</code>, <code>matched_table_count</code>, <code>matched_entity_count</code>.</li><li><code>ecs_system_stats_t</code> — per system: <code>time_spent</code>, plus the stats of its query and whether it is a task (a system with no matched entities to iterate).</li><li><code>ecs_pipeline_stats_t</code> — per pipeline: the ordered list of systems (merges shown as 0), and per <em>sync point</em> — a moment where the pipeline stops to flush queued commands — the time spent and commands enqueued.</li></ul><p>When the module is imported, these are tracked automatically for every system and pipeline and stored the same windowed way, which is how the Explorer shows a time-per-system breakdown.</p>"
      }
    ],
    related: ["obs-stats-windows", "systems", "lifecycle", "internals"]
  },
  {
    id: "obs-world-summary",
    parent: "obs-statistics",
    order: 3,
    title: "World Summary",
    code: "OBS-01C",
    tagline: "One small component with the numbers you check first",
    intro: "The full statistics struct is a wall of instruments; <code>EcsWorldSummary</code> is the sticky note on top with the essentials: FPS, frame time, entity count, and what this build of Flecs even is. The module keeps it fresh on the world entity every frame, and it is the first thing the Explorer reads when it connects.",
    sections: [
      {
        type: "code",
        heading: "Reading it",
        lang: "c",
        src: "const EcsWorldSummary *s =\n  ecs_get(world, EcsWorld, EcsWorldSummary);\n\nprintf(\"fps: %.1f\\n\", s->fps);\nprintf(\"entities: %lld\\n\", (long long)s->entity_count);\nprintf(\"flecs %s\\n\", s->build_info.version);"
      },
      {
        type: "struct",
        heading: "The component",
        name: "EcsWorldSummary",
        summary: "A plain-numbers snapshot of world health, updated every frame on the EcsWorld entity.",
        members: [
          { name: "target_fps", type: "double", desc: "The frame rate the world tries to hold. Writable: setting it here calls through to the world, which is how the Explorer's FPS control works." },
          { name: "time_scale", type: "double", desc: "Simulation speed multiplier. Also writable, so tools can slow down or speed up time." },
          { name: "fps", type: "double", desc: "Measured frames per second." },
          { name: "frame_time_total", type: "double", desc: "Total seconds ever spent processing frames." },
          { name: "system_time_total", type: "double", desc: "Total seconds ever spent running systems." },
          { name: "merge_time_total", type: "double", desc: "Total seconds ever spent merging queued commands." },
          { name: "entity_count", type: "int64_t", desc: "Number of alive entities right now." },
          { name: "table_count", type: "int64_t", desc: "Number of tables right now." },
          { name: "frame_count", type: "int64_t", desc: "Total frames processed since the world started." },
          { name: "command_count", type: "int64_t", desc: "Total deferred commands processed." },
          { name: "merge_count", type: "int64_t", desc: "Total command merges executed." },
          { name: "systems_ran_total", type: "int64_t", desc: "Total system invocations." },
          { name: "observers_ran_total", type: "int64_t", desc: "Total observer invocations." },
          { name: "queries_ran_total", type: "int64_t", desc: "Total query evaluations." },
          { name: "tag_count", type: "int32_t", desc: "Registered ids without data." },
          { name: "component_count", type: "int32_t", desc: "Registered ids with data." },
          { name: "pair_count", type: "int32_t", desc: "Registered relationship pair ids." },
          { name: "frame_time_frame", type: "double", desc: "Seconds spent on just the last frame." },
          { name: "system_time_frame", type: "double", desc: "Seconds spent in systems during the last frame." },
          { name: "merge_time_frame", type: "double", desc: "Seconds spent merging during the last frame." },
          { name: "merge_count_frame", type: "int64_t", desc: "Merges in the last frame." },
          { name: "systems_ran_frame", type: "int64_t", desc: "System invocations in the last frame." },
          { name: "observers_ran_frame", type: "int64_t", desc: "Observer invocations in the last frame." },
          { name: "queries_ran_frame", type: "int64_t", desc: "Query evaluations in the last frame." },
          { name: "command_count_frame", type: "int64_t", desc: "Commands processed in the last frame." },
          { name: "simulation_time", type: "double", desc: "Time passed inside the simulation (respects time_scale)." },
          { name: "uptime", type: "uint32_t", desc: "Real seconds since the world was created." },
          { name: "build_info", type: "ecs_build_info_t", desc: "How this Flecs was built: version, compiler, enabled addons, debug/sanitize flags. Lets tools adapt to the library they're talking to." }
        ]
      },
      {
        type: "text",
        heading: "Totals versus per-frame",
        html: "<p>Notice the pattern: most measurements come in a <code>_total</code> flavor (since the world started) and a <code>_frame</code> flavor (just the last frame). The per-frame values are computed by subtracting the previous total from the new one each frame — a cheap trick that gives you a rate without keeping history. If you need real history, that's what the windowed world statistics are for.</p>"
      }
    ],
    related: ["obs-world-stats", "remote", "world"]
  },
  {
    id: "obs-memory-stats",
    parent: "obs-statistics",
    order: 4,
    title: "Memory Statistics",
    code: "OBS-01D",
    tagline: "An itemized receipt for every byte the world uses",
    intro: "The stats addon can break down exactly where the world's memory goes: how many bytes are in component arrays, in table bookkeeping, in query caches, in name indexes. It's the difference between &quot;my game uses 200 MB&quot; and knowing which drawer the bytes are in.",
    sections: [
      {
        type: "text",
        heading: "One component, eight receipts",
        html: "<p>When the module is imported, the <code>EcsWorldMemory</code> component collects a set of category structs, each one an itemized bill:</p><ul><li><code>ecs_entities_memory_t</code> — the entity index: alive and dead entity counts, bytes for names, symbols, and doc strings.</li><li><code>ecs_component_memory_t</code> — actual component data: bytes in table columns, unused (reserved but empty) column bytes, toggle bitsets, sparse components.</li><li><code>ecs_component_index_memory_t</code> — per-component bookkeeping records and their caches.</li><li><code>ecs_query_memory_t</code> — queries: the query objects, caches, groups, sort data, compiled plans, terms.</li><li><code>ecs_table_memory_t</code> — table overhead: the table structs, entity vectors, edges of the table graph, column maps.</li><li><code>ecs_table_histogram_t</code> — a histogram of table sizes: how many tables hold 0, 1, 2-3, 4-7, ... entities. Many near-empty tables is a common sign of over-fragmentation.</li><li><code>ecs_misc_memory_t</code> — everything else: stages, observers, systems, pipelines, the command queue, type info, the REST server.</li><li><code>ecs_allocator_memory_t</code> — bytes allocators are holding in reserve but not currently using.</li></ul><p>Each category also has a direct getter (<code>ecs_tables_memory_get()</code>, <code>ecs_queries_memory_get()</code>, ...) if you want a one-off answer without the module.</p>"
      },
      {
        type: "code",
        heading: "The one-liner",
        lang: "c",
        src: "ecs_size_t total = ecs_memory_get(world);\nprintf(\"world uses %d bytes\\n\", total);\n\necs_table_memory_t tm = ecs_tables_memory_get(world);\nprintf(\"%d tables, %d empty\\n\", tm.count, tm.empty_count);"
      },
      {
        type: "diagram",
        heading: "Where the bytes live",
        spec: {
          type: "grid",
          title: "EcsWorldMemory categories",
          cols: ["Category", "What it measures", "Watch for"],
          rows: [
            ["entities", "entity index, names, doc strings", "huge name/doc bytes"],
            ["components", "table columns, sparse, bitsets", "unused column bytes"],
            ["component_index", "per-component records & caches", "growth with many pairs"],
            ["queries", "query objects, caches, plans", "large caches"],
            ["tables", "table structs, edges, vectors", "overhead vs data"],
            ["table_histogram", "tables bucketed by entity count", "many tiny tables"],
            ["misc", "stages, commands, systems, REST", "command queue size"],
            ["allocators", "reserved but unused bytes", "high retention"]
          ],
          note: "collection_time in EcsWorldMemory records how long gathering all this took — collecting memory stats is itself not free."
        }
      }
    ],
    related: ["obs-world-stats", "storage", "internals"]
  },
  {
    id: "obs-metrics",
    parent: "observability",
    order: 2,
    title: "Metrics",
    code: "OBS-02",
    tagline: "Turn any component value into a tracked instrument",
    intro: "The built-in statistics watch Flecs itself. The metrics addon (<code>FlecsMetrics</code>) lets you point the same kind of instrument at <em>your</em> data: &quot;track every entity's <code>Position.x</code>&quot;, &quot;count how many entities are Burning&quot;, &quot;measure how long each enemy has been in the Attacking state&quot;. Each metric becomes an entity whose children hold the live values, so one generic tool can discover and chart all of them.",
    sections: [
      {
        type: "text",
        heading: "Three things you can measure",
        html: "<p>A metric watches one of:</p><ul><li><strong>A member</strong> — a field of a component, named by the member entity (from the reflection addon) or a <code>dotmember</code> path like <code>&quot;position.x&quot;</code> for nested fields. One metric instance is created per entity that has the component.</li><li><strong>An id</strong> — a component, tag, or pair. Depending on the kind, this either counts entities that have it, or tracks how long each entity has had it.</li><li><strong>A OneOf relationship</strong> — for a pair like <code>(Color, *)</code> where the relationship has the <em>OneOf</em> trait (targets must be one of a fixed set of options), the metric gets one field per option, tracking which option each entity currently has and for how long.</li></ul>"
      },
      {
        type: "diagram",
        heading: "From component to time series",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "src", label: "Source entity", sub: "has Position = {10, 20}" } ],
            [ { id: "sys", label: "Metric system", sub: "runs every frame" } ],
            [ { id: "inst", label: "Metric instance", sub: "child of the metric" } ],
            [ { id: "tool", label: "Monitoring tool", sub: "Explorer, Prometheus bridge, ..." } ]
          ],
          edges: [
            { from: "src", to: "sys", label: "reads value" },
            { from: "sys", to: "inst", label: "writes EcsMetricValue" },
            { from: "inst", to: "tool", label: "queried generically" }
          ],
          note: "Every instance carries EcsMetricValue (the number), EcsMetricSource (which entity it came from), and the EcsMetricInstance tag."
        }
      },
      {
        type: "struct",
        heading: "The descriptor",
        name: "ecs_metric_desc_t",
        summary: "What you fill in for ecs_metric_init() (or the ecs_metric() shorthand).",
        members: [
          { name: "_canary", type: "int32_t", desc: "Internal validity check. Do not set." },
          { name: "entity", type: "ecs_entity_t", desc: "Optional existing entity to turn into the metric. Leave 0 to create a new one; give it a name to make the metric discoverable by path." },
          { name: "member", type: "ecs_entity_t", desc: "The member entity whose value to track, e.g. the entity for Position's x field. Mutually exclusive with id, and not allowed with EcsCounterId." },
          { name: "dotmember", type: "const char *", desc: "Alternative to member: a dot-path like \"point.x\" that supports nested members. Must be combined with id (the component to look the path up in), not with member." },
          { name: "id", type: "ecs_id_t", desc: "Component, tag, or pair to track. For value metrics this tracks how long entities have had the id; for EcsCounterId it counts entities that have it. Mutually exclusive with member." },
          { name: "targets", type: "bool", desc: "For a (R, *) wildcard pair: if R has the OneOf trait, track which target each entity has individually; with EcsCounterId, create one count per target instead of one total." },
          { name: "kind", type: "ecs_entity_t", desc: "Required. One of EcsGauge, EcsCounter, EcsCounterIncrement, or EcsCounterId — see the Gauges & Counters page." },
          { name: "brief", type: "const char *", desc: "One-line description, stored via the doc addon (only if FLECS_DOC is compiled in) so tools can show what the metric means." }
        ]
      },
      {
        type: "code",
        heading: "Two metrics",
        lang: "c",
        src: "ECS_IMPORT(world, FlecsMetrics);\n\necs_metric(world, {\n  .entity = ecs_entity(world, { .name = \"metrics.position_x\" }),\n  .member = ecs_lookup(world, \"Position.x\"),\n  .kind = EcsGauge,\n  .brief = \"Tracks x position per entity\"\n});\n\necs_metric(world, {\n  .entity = ecs_entity(world, { .name = \"metrics.burning\" }),\n  .id = Burning,\n  .kind = EcsCounterId,\n  .brief = \"Number of burning entities\"\n});"
      },
      {
        type: "text",
        heading: "Reading metrics back",
        html: "<p>Metric instances are ordinary entities: children of the metric, updated by systems the addon schedules each frame. That means you read them with an ordinary query for <code>EcsMetricValue</code> and <code>EcsMetricSource</code> — no special API. This is the whole point: a monitoring exporter can iterate <em>every metric in the app</em> without knowing any of them by name, and the Explorer lists them all under their metric parents.</p>"
      }
    ],
    related: ["obs-metric-kinds", "obs-alerts", "reflection", "queries"]
  },
  {
    id: "obs-metric-kinds",
    parent: "obs-metrics",
    order: 1,
    title: "Gauges & Counters",
    code: "OBS-02A",
    tagline: "Speedometer or odometer — pick the right instrument",
    intro: "Every metric has a <em>kind</em> that says how values behave over time. A <strong>gauge</strong> is a speedometer: it shows the value right now, and it can go down. A <strong>counter</strong> is an odometer: it only ever goes up. Flecs has one gauge kind and three counter kinds, because there are three different ways a number can &quot;only go up&quot;.",
    sections: [
      {
        type: "diagram",
        heading: "The four kinds",
        spec: {
          type: "grid",
          title: "Metric kinds compared",
          cols: ["Kind", "Works with", "Instance value"],
          rows: [
            ["EcsGauge", "member, id, oneof pair", "the value right now (id: seconds the entity has had it)"],
            ["EcsCounter", "member, id, oneof pair", "the member value copied as-is (already monotonic)"],
            ["EcsCounterIncrement", "member only", "accumulates member x delta_time each frame"],
            ["EcsCounterId", "id only", "count of entities that have the id"]
          ],
          note: "Gauge, Counter, and CounterIncrement create one instance per matching entity; CounterId creates a single instance (or one per target with a wildcard pair and targets = true)."
        }
      },
      {
        type: "text",
        heading: "Choosing between the counter kinds",
        html: "<ul><li><strong>EcsCounter</strong> is for members that are already odometers. A <code>MilesDriven</code> component only ever grows, so the metric can just mirror it.</li><li><strong>EcsCounterIncrement</strong> is for turning a speedometer into an odometer. <code>Velocity</code> goes up and down, but <em>velocity times elapsed time, summed forever</em> is distance driven — so each frame the metric adds <code>member * delta_time</code>. This is the integral of the value, computed for you.</li><li><strong>EcsCounterId</strong> ignores values entirely and counts entities. With a plain id you get one number (&quot;42 entities are Burning&quot;). With a wildcard pair like <code>(Faction, *)</code> and <code>targets</code> set, you get one instance per target (&quot;30 in RedTeam, 12 in BlueTeam&quot;).</li></ul><p>When a metric is created from an <strong>id</strong> (not a member) with the Gauge kind, the instance value is how many seconds the entity has had that id — handy for &quot;how long has this enemy been in the Attacking state&quot;. With a OneOf pair and <code>targets</code>, the instance instead gets one field per allowed target, and the field for the current target holds the duration.</p>"
      },
      {
        type: "code",
        heading: "Iterating all instances of a metric",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .expr = \"flecs.metrics.Value, flecs.metrics.Source\"\n});\n\necs_iter_t it = ecs_query_iter(world, q);\nwhile (ecs_query_next(&it)) {\n  EcsMetricValue *v = ecs_field(&it, EcsMetricValue, 0);\n  EcsMetricSource *s = ecs_field(&it, EcsMetricSource, 1);\n  for (int i = 0; i < it.count; i++) {\n    char *src = ecs_get_path(world, s[i].entity);\n    printf(\"%s = %f\\n\", src, v[i].value);\n    ecs_os_free(src);\n  }\n}"
      },
      {
        type: "text",
        heading: "Cost and gotchas",
        html: "<ul><li>Each metric adds a system that runs every frame over all matching entities — metrics are cheap individually, but a member metric on a component with a million entities touches a million values per frame.</li><li>Metric instances are real entities. A member metric on a very common component doubles the entity count for that component's population.</li><li>Instances appear and disappear automatically as sources gain and lose the component, so a chart can have gaps — that's the data telling you the entity lost the component.</li></ul>"
      }
    ],
    related: ["obs-metrics", "systems", "reflection"]
  },
  {
    id: "obs-alerts",
    parent: "observability",
    order: 3,
    title: "Alerts",
    code: "OBS-03",
    tagline: "Queries that should stay empty — and alarms when they don't",
    intro: "An alert is a smoke detector for your world: you write a query describing a situation that should never happen — &quot;an entity with Position but no Velocity&quot;, &quot;a turret with no target&quot; — and the alerts addon (<code>FlecsAlerts</code>) checks it periodically. The moment something matches, an alert instance appears with a generated message; when the situation is fixed, it clears itself.",
    sections: [
      {
        type: "code",
        heading: "A first alert",
        lang: "c",
        src: "ECS_IMPORT(world, FlecsAlerts);\n\necs_alert(world, {\n  .entity = ecs_entity(world, { .name = \"alerts.position_without_velocity\" }),\n  .query.expr = \"Position, !Velocity\",\n  .message = \"$this has Position but no Velocity\",\n  .severity = EcsAlertWarning\n});"
      },
      {
        type: "diagram",
        heading: "Life of an alert",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "q", label: "Alert query", sub: "evaluated every 0.5s" } ],
            [ { id: "i", label: "Alert instance", sub: "child of the alert entity" } ],
            [ { id: "s", label: "Source entity", sub: "gets EcsAlertsActive" } ],
            [ { id: "c", label: "Cleared", sub: "after retain_period of not matching" } ]
          ],
          edges: [
            { from: "q", to: "i", label: "entity matches" },
            { from: "i", to: "s", label: "counted on source" },
            { from: "i", to: "c", label: "stops matching" }
          ],
          note: "At most one instance exists per matched entity per alert. Instances reuse the metrics components: EcsAlertInstance holds the message, EcsMetricSource the entity, EcsMetricValue how many seconds the alert has been active."
        }
      },
      {
        type: "struct",
        heading: "The descriptor",
        name: "ecs_alert_desc_t",
        summary: "What you fill in for ecs_alert_init() (or the ecs_alert() shorthand).",
        members: [
          { name: "_canary", type: "int32_t", desc: "Internal validity check. Do not set." },
          { name: "entity", type: "ecs_entity_t", desc: "Optional existing entity to turn into the alert; name it so instances get readable paths." },
          { name: "query", type: "ecs_query_desc_t", desc: "The condition to watch for. One alert instance is created per matching entity, so the query must have at least one term on the default $this variable." },
          { name: "message", type: "const char *", desc: "Template for the alert message. Can reference query variables with $: \"$this has Position but no Velocity\", \"$this's parent $parent lost its Window\". Interpolated per instance using the script string interpolation rules." },
          { name: "doc_name", type: "const char *", desc: "Human-friendly display name, stored via the doc addon (needs FLECS_DOC)." },
          { name: "brief", type: "const char *", desc: "One-line description, stored via the doc addon (needs FLECS_DOC)." },
          { name: "severity", type: "ecs_entity_t", desc: "EcsAlertInfo, EcsAlertWarning, EcsAlertError, or EcsAlertCritical. Defaults to EcsAlertError. Stored as an (EcsAlert, severity) pair on the alert." },
          { name: "severity_filters", type: "ecs_alert_severity_filter_t[4]", desc: "Optional escalation rules: each filter says \"if the matched entity (or another query variable) has component X, use this severity instead\". One alert can be a Warning in dev and an Error on entities tagged Production, without resetting its duration when it transitions." },
          { name: "retain_period", type: "ecs_ftime_t", desc: "Seconds an alert must stay non-matching before its instance is removed. 0 clears immediately; a few seconds stops a flickering condition from spamming create/delete. While inactive, the duration doesn't grow." },
          { name: "member", type: "ecs_entity_t", desc: "Optional: alert when this member's value leaves the warning/error ranges assigned to it via the reflection addon's MemberRanges component. Flecs generates the query and message for you." },
          { name: "id", type: "ecs_id_t", desc: "For member alerts: the component id to read the member from. Defaults to the member's parent component." },
          { name: "var", type: "const char *", desc: "For member alerts: the query variable to read the member from, when it isn't $this." }
        ]
      },
      {
        type: "text",
        heading: "Finding out what's on fire",
        html: "<p>Alert state is stored where you'd look for it:</p><ul><li>Every entity with at least one active alert gets the <code>EcsAlertsActive</code> component: counts per severity (<code>info_count</code>, <code>warning_count</code>, <code>error_count</code>) plus a map from alert to instance. It is removed automatically when the last alert clears — so &quot;has EcsAlertsActive&quot; is itself a queryable condition.</li><li><code>ecs_get_alert_count(world, e, 0)</code> returns how many alerts an entity has; pass a specific alert to check just that one. <code>ecs_get_alert()</code> returns the instance entity, whose <code>EcsAlertInstance</code> holds the interpolated message.</li><li>Because instances reuse the metric components, anything that can browse metrics — the Explorer's alert panel, an exporter — can browse alerts the same way.</li></ul><p>Alerts are checked on a half-second interval rather than every frame: alarm latency of 0.5s is fine, and it keeps the watchdogs cheap.</p>"
      }
    ],
    related: ["obs-metrics", "queries", "reflection", "remote"]
  },
  {
    id: "obs-doc",
    parent: "observability",
    order: 4,
    title: "The Doc Addon",
    code: "OBS-04",
    tagline: "Sticky notes, links, and colors for any entity",
    intro: "The doc addon lets you attach human-facing information to any entity: a display name, a short description, a long one, a link, a color, a UUID. Since components and systems <em>are</em> entities, this is how you document your whole API in a way tools can read back at runtime — the Explorer shows briefs as tooltips and uses colors to tint entities.",
    sections: [
      {
        type: "code",
        heading: "Documenting an entity",
        lang: "c",
        src: "ecs_entity_t e = ecs_entity(world, { .name = \"MaxSpeed\" });\n\necs_doc_set_name(world, e, \"Maximum speed (m/s)\");\necs_doc_set_brief(world, e, \"Top speed for a vehicle\");\necs_doc_set_detail(world, e, \"Used by the movement system to clamp velocity.\");\necs_doc_set_link(world, e, \"https://example.com/docs/max-speed\");\necs_doc_set_color(world, e, \"#4981B5\");\necs_doc_set_uuid(world, e, \"a2c6...\");\n\nconst char *brief = ecs_doc_get_brief(world, e);"
      },
      {
        type: "text",
        heading: "How it's stored: pairs, not magic",
        html: "<p>All six setters store their string in the same component, <code>EcsDocDescription</code> (a single owned string), paired with a tag that says which kind of note it is:</p><ul><li><code>(EcsDocDescription, EcsName)</code> — display name. Unlike real entity names, doc names don't have to be unique and may contain any characters (a real name like <code>*</code> would collide with the query language). <code>ecs_doc_get_name()</code> falls back to the entity name if no doc name is set.</li><li><code>(EcsDocDescription, EcsDocBrief)</code> — one-liner, shown as tooltips.</li><li><code>(EcsDocDescription, EcsDocDetail)</code> — the long-form explanation.</li><li><code>(EcsDocDescription, EcsDocLink)</code> — URL to external docs; the Explorer renders it as a link.</li><li><code>(EcsDocDescription, EcsDocColor)</code> — a color hint for UIs.</li><li><code>(EcsDocDescription, EcsDocUuid)</code> — an external identity, so tools and pipelines can match this entity to a row in some other database across runs.</li></ul><p>Because it's ordinary pair data, documentation is queryable (&quot;all entities with a doc link&quot;), serializes to JSON with the rest of the entity, and costs nothing for entities that don't use it.</p>"
      },
      {
        type: "text",
        heading: "Who writes it for you",
        html: "<p>You're not the only author. When <code>FLECS_DOC</code> is compiled in, other addons fill these in too: the <code>brief</code> field of a metric or alert descriptor lands here, modules document their own components, and imported reflection data can carry descriptions. One convention, one storage, every tool benefits.</p>"
      }
    ],
    related: ["obs-alerts", "obs-metrics", "remote", "components"]
  },
  {
    id: "obs-logging",
    parent: "observability",
    order: 5,
    title: "Logging",
    code: "OBS-05",
    tagline: "Nine volumes of ship's intercom, from fatal to firehose",
    intro: "Flecs has a built-in logging framework used by every part of the library — and available to your code too. Every message has a <em>level</em>: negative levels are problems (warnings, errors), zero and up are increasingly chatty tracing. One knob, <code>ecs_log_set_level()</code>, decides how much you hear.",
    sections: [
      {
        type: "diagram",
        heading: "The levels",
        spec: {
          type: "grid",
          title: "Log levels from quiet to loud",
          cols: ["Level", "Macro", "What it means"],
          rows: [
            ["-4", "ecs_fatal", "the application cannot continue"],
            ["-3", "ecs_err", "an operation failed"],
            ["-2", "ecs_warn", "something's off, but the operation succeeded"],
            ["-1", "(default setting)", "show only errors and warnings"],
            ["0", "ecs_trace", "infrequent events: world init, module imports"],
            ["1", "ecs_dbg_1 / ecs_dbg", "high-level debug: frame, merge, sync points"],
            ["2", "ecs_dbg_2", "operation-level debug"],
            ["3", "ecs_dbg_3", "the firehose: per-entity details"],
            ["4", "(journal)", "journal output, see the Journal page"]
          ],
          note: "A message is shown when its level is at or below the configured level. The default is -1: problems only."
        }
      },
      {
        type: "text",
        heading: "Runtime knob, compile-time ceiling",
        html: "<p><code>ecs_log_set_level(3)</code> raises the volume at runtime (it returns the previous level, handy for restoring). But there's a ceiling set at compile time: the macros <code>FLECS_LOG_0</code> through <code>FLECS_LOG_3</code> decide which debug statements exist in the binary at all — compiled-out levels cost literally nothing. Debug builds default to <code>FLECS_LOG_3</code> (everything available), release builds to <code>FLECS_LOG_0</code> (only <code>ecs_trace</code> and problems). So if you set level 3 in a release build and see nothing extra, that's why.</p><p>Formatting extras:</p><ul><li><code>ecs_log_enable_colors(false)</code> — ANSI colors are on by default; turn them off when writing to files.</li><li><code>ecs_log_enable_timestamp(true)</code> — prefix each line with the time.</li><li><code>ecs_log_enable_timedelta(true)</code> — prefix lines with <code>+N</code>, the seconds since the previous log line. Great for spotting which step of a slow startup ate the time.</li><li><code>ecs_log_push()</code> / <code>ecs_log_pop()</code> — indent nested messages, which Flecs itself uses to show operation nesting.</li></ul>"
      },
      {
        type: "text",
        heading: "Errors, asserts, and aborting",
        html: "<p>When Flecs detects misuse — an invalid parameter, an operation during readonly mode — it logs an error with an error code (<code>ECS_INVALID_PARAMETER</code>, <code>ECS_INVALID_WHILE_READONLY</code>, ...; <code>ecs_strerror()</code> turns codes into text) and, in debug builds, <strong>aborts</strong> via <code>ecs_assert</code>. That's deliberate: an assert that crashes at the call site with a clear message beats a corrupted world that crashes an hour later. In release builds asserts compile out unless you define <code>FLECS_KEEP_ASSERT</code>; with <code>FLECS_SOFT_ASSERT</code>, failures log and bail out of the operation instead of aborting.</p><p><code>ecs_log_last_error()</code> returns (and resets) the last logged error code — useful in tests.</p>"
      },
      {
        type: "code",
        heading: "Capturing log output",
        lang: "c",
        src: "ecs_log_set_level(0);\necs_log_start_capture(false);\n\necs_entity_t e = ecs_new(world);\necs_trace(\"created entity %u\", (uint32_t)e);\n\nchar *log = ecs_log_stop_capture();\nprintf(\"captured:\\n%s\", log);\necs_os_free(log);"
      }
    ],
    related: ["obs-journal", "internals", "world"]
  },
  {
    id: "obs-journal",
    parent: "observability",
    order: 6,
    title: "The Journal",
    code: "OBS-06",
    tagline: "A black box that writes your bug as runnable C code",
    intro: "The journal addon is a flight data recorder for the world: with <code>FLECS_JOURNAL</code> compiled in, every structural operation — creating, deleting, adding, removing — is logged as a line of <em>runnable C code</em>. When something goes wrong after ten thousand operations, you don't reconstruct what happened; you paste the trace into a test and replay it.",
    sections: [
      {
        type: "text",
        heading: "What gets recorded",
        html: "<p>The journal hooks the world's internal operations, so it captures everything no matter which API produced it — your C calls, script assignments, command flushes. The recorded kinds are: entity creation (<code>new</code>), moves between tables (add/remove), <code>clear</code>, <code>delete</code>, parent changes, bulk operations (<code>delete_with</code>, <code>remove_all</code>), and table events.</p><p>Each numbered line is a valid C statement using stable variable names derived from the entity id, with a trailing comment showing the human-readable entity path. Entities without symbols become variables like <code>_456</code>, declared on first use behind an include-guard-style check so the trace compiles even when the same entity appears many times.</p>"
      },
      {
        type: "code",
        heading: "What a trace looks like",
        lang: "c",
        title: "journal output (color codes and comments stripped)",
        src: "1: ecs_entity_t _456;\n1: _456 = ecs_new(world);\n2: ecs_add_id(world, _456, Position);\n3: ecs_add_id(world, _456, ecs_pair(EcsChildOf, Ship));\n4: ecs_delete(world, _456);"
      },
      {
        type: "text",
        heading: "Turning it on, and what it costs",
        html: "<p>The journal is off by default and has to be compiled in:</p><ul><li>Build with <code>FLECS_JOURNAL</code> defined (it automatically pulls in <code>FLECS_LOG</code>).</li><li>Journal lines are emitted through the log framework at level 4, and journaling is suppressed while the runtime log level is below trace — so raise it with <code>ecs_log_set_level(4)</code> to see the full trace.</li></ul><p>Fair warning from the addon itself: enabling journaling can have a <strong>significant impact on performance</strong> — it formats strings for every operation in the world. It's a debugging tool, not a production feature.</p><p>Two honest limitations: the trace records <em>structural</em> operations, not component values (an <code>ecs_set</code> shows up as the add, without the data), so a replay reproduces the shape of the world rather than its exact contents — which is usually exactly what a storage bug needs. And because output goes through the log, you can combine it with <code>ecs_log_start_capture()</code> to collect a trace programmatically.</p>"
      }
    ],
    related: ["obs-logging", "storage", "lifecycle", "internals"]
  }
]);
