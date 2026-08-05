# Flecs Directory — Datatype Authoring Guide

The Ship Directory is a browsable map of every Flecs datatype — public API
types AND internal engine types. Entries live in `dirdata/*.js`:

```js
window.FLECS_DIR.register([
  { /* type entry */ },
]);
```

Files must be plain browser JS. No code comments.

## Entry schema

```js
{
  id: 'ecs_table_t',              // required, the EXACT C type name, globally unique
  kind: 'struct',                 // required: struct | enum | union | typedef | flags | callback
  visibility: 'internal',         // required: 'public' (in include/) or 'internal' (in src/)
  region: 'storage',              // required, see region list below
  parent: 'ecs_world_t',          // conceptual container type (id), null for a region's root types.
                                  // Forms the traversal chain, e.g. ecs_world_t -> ecs_table_t -> ecs_column_t
  order: 2,                       // required, sort among siblings
  summary: 'One row-group of entities that share the exact same component set',  // one plain line
  eli5: '<p>ELI5 explanation, 1-3 short paragraphs of HTML. Same tone rules as CONTENT-GUIDE.md: analogy first, then the real mechanics.</p>',
  declaredIn: 'src/storage/table.h',   // required, repo-relative path where it is defined
  aka: 'uint64_t',                // typedefs only: the underlying type
  members: [                      // structs/unions/callbacks: EVERY member, in declaration order
    { name: 'type', type: 'ecs_type_t', desc: 'The sorted list of component ids this table stores — the table\'s identity.' },
  ],
  constants: [                    // enums/flags: EVERY constant
    { name: 'EcsQueryCacheAuto', value: '2', desc: 'Let Flecs decide: cache what can be cached, evaluate the rest on the fly.' },
  ],
  related: ['ecs_record_t'],      // optional, other entry ids
  tour: ['sto-tables'],           // tour page ids where this type is relevant (check the ids in the matching data/*.js file). Most entries should have at least one.
}
```

Rules for members/constants:
- List EVERY member/constant. For genuinely giant structs (ecs_world_t,
  ecs_world_stats_t, ecs_os_api_t) you may insert divider rows
  `{ name: '— group label —', type: '', desc: 'what this group is for' }`
  between groups, but each real member still gets its own row and desc.
- desc is plain text (no HTML), ELI5 style, and must say what the member DOES
  or is FOR — not just restate its name. Mention units, ownership, and
  invariants when they matter ("owned by the table, freed on table delete").
- The `type` string should be the real C type. If it names another directory
  entry the UI auto-links it; you don't need to do anything.
- Bitfield members and #define flag groups near a type may be folded into the
  owning entry as constants with kind 'flags' entries where cleaner.

Verify every member against the actual repo at
/Users/sandermertens/GitHub/SanderMertens/flecs_agent_3 (include/ and src/).
Never invent members. Preserve declaration order.

## Regions

world-core, storage, queries, events, systems, reflection, script, remote,
observability, foundation

parent chains may cross regions (e.g. a storage root's parent is ecs_world_t
in world-core). Types parented to another region's type still belong to your
region.

## Tone

Same voice as the tour (see CONTENT-GUIDE.md): a smart beginner should
understand every desc. Flecs vocabulary is fine; compiler/database jargon is
not, unless explained inline.
