# Flecs Tour — Content Authoring Guide

Every content file lives in `data/` and registers nodes like this:

```js
window.FLECS_TOUR.register([
  { /* node */ },
  { /* node */ },
]);
```

Files must be plain browser JS (no modules, no imports, no top-level await).
Do not write code comments. String content may contain limited HTML (see below).

## Node schema

```js
{
  id: 'cached-queries',          // required, globally unique, kebab-case
  parent: 'queries',             // required (id of parent node); top-level decks are predefined
  order: 2,                      // required, sibling sort order (1..n)
  title: 'Cached Queries',       // required, short
  code: 'QRY-02',                // required, LCARS-style designation: 3-4 letter deck prefix + number
  tagline: 'A saved answer that updates itself',   // required, one plain-text line, no jargon
  intro: 'One or two ELI5 sentences that explain the concept to someone who has never used an ECS. Plain text, may use <code> and <em>.',  // required
  sections: [ /* blocks, see below */ ],   // required, 2-6 blocks
  related: ['rematching', 'change-detection'],   // optional, ids of related nodes anywhere in the tree
}
```

## Section blocks

Text block:
```js
{ type: 'text', heading: 'How it works', html: '<p>...</p><ul><li>...</li></ul>' }
```
Allowed tags: `p, ul, ol, li, strong, em, code, br`. Keep paragraphs short.
ELI5 rule: explain with everyday analogies first, then name the Flecs term.
Avoid CS jargon (say "a list that grows" instead of "dynamic array") except
Flecs' own vocabulary (entity, component, table, query...), which you should
use and define on first use.

Code block:
```js
{ type: 'code', heading: 'Try it', lang: 'c', title: 'optional caption', src: 'ecs_entity_t e = ecs_new(world);' }
```
`lang` is `c` or `flecs` (for Flecs Script) or `json` or `bash`. Prefer short,
runnable-looking C snippets using the real Flecs API. Escape nothing; this is a
JS string, so escape backslashes/quotes/newlines as needed (template literals are fine).

Struct block (use for the key datatypes of your topic — every member explained):
```js
{ type: 'struct', heading: 'The datatype', name: 'ecs_query_desc_t',
  summary: 'What you fill in to create a query.',
  members: [
    { name: 'terms', type: 'ecs_term_t[32]', desc: 'The list of things the query looks for. Each term is one condition, like "must have Position".' },
  ]
}
```
Get members from the real headers (`include/flecs.h`, `include/flecs/addons/*.h`).
It is fine to group trailing internal members into one row named `...internal`
with a short note, but all public/interesting members must be listed and the
`desc` must say what the member does in plain language.

Diagram blocks (the shell renders these; prefer them over raw SVG):

Flow diagram — boxes in columns, arrows between them:
```js
{ type: 'diagram', heading: 'The pipeline', spec: {
  type: 'flow',
  lanes: [
    [ { id: 'a', label: 'Your code', sub: 'calls ecs_add' } ],
    [ { id: 'b', label: 'Command queue', sub: 'while deferred' },
      { id: 'c', label: 'Table', sub: 'when not deferred' } ],
  ],
  edges: [
    { from: 'a', to: 'b', label: 'deferred' },
    { from: 'a', to: 'c', dashed: true },
  ],
}}
```
Each inner array of `lanes` is one column, rendered left to right.
`sub` is an optional smaller second line. 2-4 lanes, max ~5 boxes per lane.

Stack diagram — layered boxes, top to bottom:
```js
{ type: 'diagram', heading: 'Layers', spec: {
  type: 'stack',
  layers: [
    { label: 'Application', sub: 'your game' },
    { label: 'Flecs core' },
  ],
}}
```

Grid diagram — for showing tables/archetypes (rows of entities, columns of components):
```js
{ type: 'diagram', heading: 'A table', spec: {
  type: 'grid',
  title: 'Table [Position, Velocity]',
  cols: ['Entity', 'Position', 'Velocity'],
  rows: [
    ['e1', '10, 20', '1, 0'],
    ['e2', '3, 5', '0, 2'],
  ],
  note: 'optional caption under the grid',
}}
```

## Tone

- ELI5 first: every page must open with an explanation a smart 10-year-old
  could follow, using a concrete analogy (library, filing cabinet, restaurant...).
- Then go deep: later sections can and should get precise and technical, but
  introduce each term before using it.
- Never assume the reader knows other ECS frameworks, C++ templates, database
  theory, or compiler theory. If you need such a concept, explain it inline in
  one sentence.
- Active voice, second person ("you ask the world for...").

## Depth

Model each deck as a hierarchy 2-4 levels deep. Leaf pages should be genuinely
detailed (the "rematching" level of detail: what, why, when it happens, cost,
gotchas). Parent pages summarize and hand off to children. Aim for the number
of nodes your deck instructions specify.

## Ground truth

Base everything on the actual repo at `/Users/sandermertens/GitHub/SanderMertens/flecs_agent_3`:
docs in `docs/*.md`, public API in `include/flecs.h` and `include/flecs/addons/`,
implementation in `src/`. Do not invent APIs or struct members. Verify struct
members against the headers before writing them down.
