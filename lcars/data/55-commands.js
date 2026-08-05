window.FLECS_TOUR.register([
  {
    id: "lif-deferring",
    parent: "commands",
    order: 1,
    title: "Deferring & Commands",
    code: "CMD-01",
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
      },
      {
        type: "text",
        heading: "What the notepad is made of",
        html: "<p>Each stage — the per-thread context a system runs in — owns its own queue: a growable list of <code>ecs_cmd_t</code> entries, a stack allocator holding stashed component values, and a sparse set of per-entity bookkeeping. Recording an <code>ecs_add</code> appends one entry and returns; nothing touches the storage.</p><p>Values need extra care. An <code>ecs_set</code> while deferred copies your value into the queue's stack allocator (through the component's copy hook, if it has one) so it survives until the flush, even if your local variable is long gone. <code>ecs_ensure</code> is the shortcut around that copy: while deferred it hands you a pointer straight into that scratch space, so you write the value once, in place.</p><p>A stage actually carries <em>two</em> queues. While one is being executed, commands triggered by that execution — an observer reacting to an add, say — are recorded into the other. The flush loops until both come up empty.</p>"
      },
      {
        type: "struct",
        heading: "One command",
        name: "ecs_cmd_t",
        summary: "From src/commands.h. One recorded operation.",
        members: [
          { name: "kind", type: "ecs_cmd_kind_t", desc: "Which operation this is: EcsCmdAdd, EcsCmdRemove, EcsCmdSet, EcsCmdDelete, EcsCmdClear, EcsCmdEvent and friends. EcsCmdSkip marks a command that was cancelled out during batching." },
          { name: "next_for_entity", type: "int32_t", desc: "Index of the next command in the queue that targets the same entity — a linked list threaded through the queue. Negative on the first command of an entity's chain, as a marker." },
          { name: "id", type: "ecs_id_t", desc: "The component or pair the operation applies to." },
          { name: "entry", type: "ecs_cmd_entry_t*", desc: "Per-entity bookkeeping in the sparse set: the first and last command index for this entity. A last of -1 means this entity was deleted, so everything else for it can be ignored." },
          { name: "entity", type: "ecs_entity_t", desc: "The entity the operation targets." },
          { name: "is._1", type: "ecs_cmd_1_t", desc: "Payload for single-entity operations: a pointer to the stashed component value and its size." },
          { name: "is._n", type: "ecs_cmd_n_t", desc: "Payload for bulk operations: an array of entity ids and a count." },
          { name: "system", type: "ecs_entity_t", desc: "Which system enqueued this, so errors during the flush can name the culprit." }
        ]
      }
    ],
    related: ["lif-command-batching", "lif-staging", "evt-observer-execution", "int-vec-allocators"]
  },
  {
    id: "lif-command-batching",
    parent: "lif-deferring",
    order: 1,
    title: "Command Batching",
    code: "CMD-01A",
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
      },
      {
        type: "text",
        heading: "Following the chain",
        html: "<p>The queue can find one entity's commands instantly because it built a trail while recording: a sparse set entry remembers the <em>first</em> and <em>last</em> command index for each entity, and every command's <code>next_for_entity</code> points at that entity's next one — a linked list threaded through the queue.</p><p>At flush time <code>flecs_cmd_batch_for_entity</code> walks a whole chain in one pass and builds a single <em>diff</em>: the net set of ids to add and remove. The entity then moves once, all add and remove events fire against that one move, and set commands write their stashed values into the final location. Commands that cancel out are stamped <code>EcsCmdSkip</code> along the way:</p><ul><li><strong>Add then remove</strong> of the same id inside one batch: both vanish — the world never hears about either.</li><li><strong>Two sets</strong> of the same component: folded, so the component lands with the final value.</li><li><strong>Anything around a delete:</strong> recording a delete marks the entity's entry, and every other command for it is skipped. A dead entity needs no new coat of paint.</li><li><strong>Entities that died some other way</strong> — cleaned up because their parent went first, for instance — are skipped instead of crashing.</li></ul>"
      },
      {
        type: "diagram",
        heading: "One entity's chain, merged",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "b1", label: "cmd 0: add Position", sub: "next_for_entity: 2" },
              { id: "b2", label: "cmd 2: set Velocity", sub: "next_for_entity: 5" },
              { id: "b3", label: "cmd 5: remove Position", sub: "end of chain" } ],
            [ { id: "b4", label: "Batch diff", sub: "net: add Velocity" } ],
            [ { id: "b5", label: "One table move", sub: "[] to [Velocity]" } ]
          ],
          edges: [
            { from: "b1", to: "b4", dashed: true, label: "cancels with cmd 5" },
            { from: "b2", to: "b4" },
            { from: "b3", to: "b4", dashed: true },
            { from: "b4", to: "b5" }
          ],
          note: "Position was added and removed in the same batch, so it never existed as far as tables and observers are concerned."
        }
      }
    ],
    related: ["lif-deferring", "evt-observer-execution", "evt-custom-events", "sto-table-moves"]
  },
  {
    id: "lif-staging",
    parent: "commands",
    order: 2,
    title: "Staging",
    code: "CMD-02",
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
