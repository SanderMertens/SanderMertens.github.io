window.FLECS_TOUR.register([
  {
    id: "qry-anatomy",
    parent: "queries",
    order: 1,
    title: "Anatomy of a Query",
    code: "QRY-01",
    tagline: "A checklist of conditions an entity must pass",
    intro: "A query is like a checklist you hand to the world: &quot;find me everything that has Position, has Velocity, and is not Frozen&quot;. Each line on the checklist is called a <em>term</em>, and an entity only shows up in the results if it passes every term.",
    sections: [
      {
        type: "text",
        heading: "Terms: the lines on the checklist",
        html: "<p>Every query is a list of up to 32 terms (the <code>FLECS_TERM_COUNT_MAX</code> limit, which can be raised at compile time). A term is one condition, and the simplest condition is &quot;must have this component&quot;. But a term can express much more:</p><ul><li><strong>What</strong> to look for: a component, a tag, or a relationship pair like <code>(Likes, Bob)</code>.</li><li><strong>Where</strong> to look for it: on the matched entity itself, on a specific entity, or on something reached by walking a relationship (like a parent). This is the term's <em>source</em>.</li><li><strong>How</strong> to combine it with other terms: and, or, not, optional. This is the term's <em>operator</em>.</li><li><strong>Whether</strong> the query reads or writes the data. This is the term's <em>access modifier</em>.</li></ul><p>You describe all of this in a <code>ecs_query_desc_t</code> struct and pass it to <code>ecs_query</code>, which returns a <code>ecs_query_t</code> you can iterate as often as you like.</p>"
      },
      {
        type: "code",
        heading: "Creating a query",
        lang: "c",
        title: "The ecs_query macro wraps ecs_query_init",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn },\n    { ecs_id(Frozen), .oper = EcsNot },\n  }\n});\n\necs_query_fini(q);"
      },
      {
        type: "text",
        heading: "Who owns the query?",
        html: "<p>Queries you create yourself must be deleted with <code>ecs_query_fini</code>. But you can also hand the query an entity by setting the <code>entity</code> member of the descriptor. The query then lives and dies with that entity: deleting the entity deletes the query. This is exactly what systems do — every system is an entity whose query is tied to it — and it is also what flips a query's default caching behavior to <em>cached</em>.</p>"
      },
      {
        type: "diagram",
        heading: "One query, three terms",
        spec: {
          type: "grid",
          title: "Query: Position, [in] Velocity, !Frozen",
          cols: ["Term", "What (first)", "Source (src)", "Operator", "Access"],
          rows: [
            ["0", "Position", "$this", "And", "inout"],
            ["1", "Velocity", "$this", "And", "in"],
            ["2", "Frozen", "$this", "Not", "none"]
          ],
          note: "$this is the implicit variable that stands for 'the entity being matched'. All three terms share it, so all conditions apply to the same entity."
        }
      },
      {
        type: "struct",
        heading: "The descriptor you fill in",
        name: "ecs_query_desc_t",
        summary: "Everything you can say about a query when creating it with ecs_query_init(). Only terms (or expr) is required; the rest is optional.",
        members: [
          { name: "_canary", type: "int32_t", desc: "Safety check field. Must be zero; Flecs uses it to catch uninitialized descriptors in debug builds." },
          { name: "terms", type: "ecs_term_t[32]", desc: "The checklist itself: up to 32 conditions, each one an ecs_term_t. Unused slots stay zeroed." },
          { name: "expr", type: "const char *", desc: "Alternative to terms: a query written as text in the Flecs Query Language, like \"Position, !Velocity\". Parsed into terms for you." },
          { name: "cache_kind", type: "ecs_query_cache_kind_t", desc: "The caching policy: Default (decide from context), Auto (cache what can be cached), All (fail unless everything can be cached), or None." },
          { name: "flags", type: "ecs_flags32_t", desc: "Feature switches, like EcsQueryMatchPrefab (also match prefabs), EcsQueryMatchEmptyTables, or EcsQueryDetectChanges (enable change detection)." },
          { name: "order_by_callback", type: "ecs_order_by_action_t", desc: "A compare function, like the one you would give a sort routine. Setting it turns this into a sorted query." },
          { name: "order_by_table_callback", type: "ecs_sort_table_action_t", desc: "Optional faster alternative that sorts a whole table in one call instead of comparing two entities at a time." },
          { name: "order_by", type: "ecs_entity_t", desc: "Which component's value to sort on. Leave zero to sort by entity id." },
          { name: "group_by", type: "ecs_id_t", desc: "Component id passed to the grouping callback, typically a relationship like (Region, *)." },
          { name: "group_by_callback", type: "ecs_group_by_action_t", desc: "Function that computes a group id for each matched table, so tables can be bucketed and iterated per group." },
          { name: "on_group_create", type: "ecs_group_create_action_t", desc: "Called when a table with a brand new group id shows up. Its return value is stored as that group's context." },
          { name: "on_group_delete", type: "ecs_group_delete_action_t", desc: "Called when the last table of a group disappears, so you can clean up the group context." },
          { name: "group_by_ctx", type: "void *", desc: "User pointer handed to the group_by callback." },
          { name: "group_by_ctx_free", type: "ecs_ctx_free_t", desc: "Called to free group_by_ctx when the query is destroyed." },
          { name: "ctx", type: "void *", desc: "General user pointer you can fetch back from the query, handy for passing data into system callbacks." },
          { name: "binding_ctx", type: "void *", desc: "Like ctx, but reserved for language bindings (the C++ API uses it internally)." },
          { name: "ctx_free", type: "ecs_ctx_free_t", desc: "Called to free ctx when the query is destroyed." },
          { name: "binding_ctx_free", type: "ecs_ctx_free_t", desc: "Called to free binding_ctx when the query is destroyed." },
          { name: "entity", type: "ecs_entity_t", desc: "Optional entity to tie the query to. Deleting the entity deletes the query, and it makes the query default to cached." }
        ]
      },
      {
        type: "struct",
        heading: "One term, field by field",
        name: "ecs_term_t",
        summary: "A single condition in a query. Most of the time you only set id, but src, first and second give you full control.",
        members: [
          { name: "id", type: "ecs_id_t", desc: "The component id to match. The shortcut: set this directly with ecs_id(Position) or ecs_pair(Likes, Bob), and skip first/second." },
          { name: "src", type: "ecs_term_ref_t", desc: "The source: which entity must have the component. Defaults to the $this variable, meaning 'the entity being matched'." },
          { name: "first", type: "ecs_term_ref_t", desc: "What to match: the component, or the first element of a pair (the Likes in (Likes, Bob)). Alternative to setting id directly." },
          { name: "second", type: "ecs_term_ref_t", desc: "The second element of a pair (the Bob in (Likes, Bob)). Leave empty for plain components." },
          { name: "trav", type: "ecs_entity_t", desc: "The relationship to walk when the term uses up traversal, like ChildOf to search parents. Defaults to IsA. Must have the Traversable trait." },
          { name: "inout", type: "int16_t", desc: "Access modifier: EcsIn, EcsOut, EcsInOut, EcsInOutNone or EcsInOutFilter. Says whether the query reads or writes the data." },
          { name: "oper", type: "int16_t", desc: "Operator: EcsAnd, EcsOr, EcsNot, EcsOptional, EcsAndFrom, EcsOrFrom or EcsNotFrom." },
          { name: "field_index", type: "int8_t", desc: "Which field in the iterator this term's data lands in. Filled in by Flecs; terms in an Or chain share one field." },
          { name: "flags_", type: "ecs_flags16_t", desc: "...internal: evaluation hints computed by ecs_query_init(), not meant to be set by you." }
        ]
      }
    ],
    related: ["qry-operators", "qry-access", "qry-sources", "qry-traversal", "qry-language"]
  },
  {
    id: "qry-operators",
    parent: "qry-anatomy",
    order: 1,
    title: "Operators",
    code: "QRY-01A",
    tagline: "And, or, not, maybe — how terms combine",
    intro: "By default every term on the checklist must pass — that's the <em>And</em> operator. Other operators let a term say &quot;must <em>not</em> have this&quot;, &quot;one of these will do&quot;, or &quot;nice to have, but not required&quot;.",
    sections: [
      {
        type: "text",
        heading: "The seven operators",
        html: "<p>Each term has exactly one operator, set with the <code>oper</code> member:</p><ul><li><strong>And</strong> (<code>EcsAnd</code>, the default): the entity must have this. In the query language it's just a comma: <code>Position, Velocity</code>.</li><li><strong>Or</strong> (<code>EcsOr</code>): at least one term in an or-chain must match: <code>Velocity || Speed</code>. Set <code>EcsOr</code> on a term to chain it with the <em>next</em> term.</li><li><strong>Not</strong> (<code>EcsNot</code>): the entity must <em>not</em> have this: <code>!Frozen</code>.</li><li><strong>Optional</strong> (<code>EcsOptional</code>): match whether or not the entity has it: <code>?Velocity</code>. Doesn't change which entities match, but if the component is there, you get it — which is cheaper than a separate <code>ecs_get</code> and saves you from splitting one query into several. Check with <code>ecs_field_is_set</code> before reading.</li><li><strong>AndFrom</strong> (<code>EcsAndFrom</code>): must have <em>all</em> components that some other entity (typically a prefab) has: <code>and|MyType</code>. A checklist that borrows its lines from another entity.</li><li><strong>OrFrom</strong> (<code>EcsOrFrom</code>): must have at least one of them: <code>or|MyType</code>.</li><li><strong>NotFrom</strong> (<code>EcsNotFrom</code>): must have none of them: <code>not|MyType</code>.</li></ul>"
      },
      {
        type: "code",
        heading: "Or in C, and the field it shares",
        lang: "c",
        title: "Four terms, three fields",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .oper = EcsOr },\n    { ecs_id(Speed) },\n    { ecs_id(Mass) }\n  }\n});\n\necs_iter_t it = ecs_query_iter(world, q);\nwhile (ecs_query_next(&it)) {\n  Position *p = ecs_field(&it, Position, 0);\n  Mass *m = ecs_field(&it, Mass, 2);\n  ecs_id_t vs_id = ecs_field_id(&it, 1);\n}"
      },
      {
        type: "text",
        heading: "Watch out: Or chains merge fields",
        html: "<p>Terms in an Or chain can each produce a different component, so they are folded into a <em>single field</em> in the iterator. The query above has 4 terms but only 3 fields: <code>Position</code> is field 0, <code>Velocity || Speed</code> together are field 1, and <code>Mass</code> is field 2 — not 3. Use <code>ecs_field_id</code> to find out which of the two actually matched for the current result.</p>"
      },
      {
        type: "text",
        heading: "Equality predicates",
        html: "<p>A special family of operators compares a <em>variable</em> against a value instead of testing for a component. In the query language they look like <code>$this == UssEnterprise</code>, <code>$this != $other</code>, or the fuzzy name match <code>$this ~= &quot;Uss&quot;</code> (matches entities whose name contains the substring). Under the hood these use the builtin <code>EcsPredEq</code>, <code>EcsPredMatch</code> and <code>EcsPredLookup</code> entities as the term's <em>first</em> element. When an equality term is the first place a variable appears, it doesn't test — it <em>assigns</em> the variable.</p><p>There are also <em>query scopes</em>: wrapping terms in <code>!{ ... }</code> negates the result of the whole group, which lets you say things like &quot;spaceships where <em>none</em> of the engines are healthy&quot;.</p>"
      }
    ],
    related: ["qry-language", "qry-variables", "qry-fields"]
  },
  {
    id: "qry-access",
    parent: "qry-anatomy",
    order: 2,
    title: "Access Modifiers",
    code: "QRY-01B",
    tagline: "Telling Flecs whether you read, write, or just look",
    intro: "An access modifier is a promise about what you'll do with the data a term matches: only read it (<code>[in]</code>), only write it (<code>[out]</code>), both (<code>[inout]</code>), or neither (<code>[none]</code>). Keeping that promise honest pays off, because Flecs uses it to schedule systems and to track what changed.",
    sections: [
      {
        type: "text",
        heading: "The modifiers",
        html: "<p>Set with the <code>inout</code> member of a term, or in brackets in the query language:</p><ul><li><code>EcsIn</code> / <code>[in]</code> — read-only. The C++ API infers this from <code>const</code>.</li><li><code>EcsOut</code> / <code>[out]</code> — write-only.</li><li><code>EcsInOut</code> / <code>[inout]</code> — read and write.</li><li><code>EcsInOutNone</code> / <code>[none]</code> — match the term, but don't touch the data at all. The iterator won't even fetch a pointer for it.</li><li><code>EcsInOutFilter</code> / <code>[filter]</code> — like none, and additionally the term won't produce events (used with observers).</li></ul><p>If you set nothing, you get <code>EcsInOutDefault</code>: <code>inout</code> for components owned by the matched entity, <code>in</code> for components that come from <em>somewhere else</em> (a fixed source, a parent reached by traversal, an inherited prefab component), and <code>none</code> for tags, which have no data. The &quot;in for shared data&quot; default protects you from accidentally writing to a component that many entities share.</p>"
      },
      {
        type: "code",
        heading: "Declaring access",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn }\n  }\n});"
      },
      {
        type: "text",
        heading: "Why honesty matters",
        html: "<p>Access modifiers are more than documentation:</p><ul><li><strong>Scheduling.</strong> The pipeline uses them to decide where to insert sync points between systems: if one system writes a component and a later system reads it, the scheduler knows queued-up commands must be flushed in between, and which systems can safely run on different threads.</li><li><strong>Change detection.</strong> When a query with <code>inout</code> or <code>out</code> terms iterates a table, Flecs marks those components as changed — whether or not you actually wrote them. A query that only reads should say <code>[in]</code>, or it will trip other queries' change detection (and its own re-sorting) forever.</li><li><strong>Serialization.</strong> Tools that serialize iterator results (like <code>ecs_iter_to_json</code> feeding the Explorer) can skip values marked out or none.</li></ul>"
      }
    ],
    related: ["qry-change-detection", "systems", "qry-sorting"]
  },
  {
    id: "qry-sources",
    parent: "qry-anatomy",
    order: 3,
    title: "Term Sources",
    code: "QRY-01C",
    tagline: "Whose pockets does the query search?",
    intro: "Every term has a <em>source</em>: the entity that must have the component. Usually it's <code>$this</code> — the entity being matched — but a term can also point at one fixed entity (&quot;the Game entity's clock&quot;) or at a query variable that gets filled in during matching.",
    sections: [
      {
        type: "text",
        heading: "Three kinds of source",
        html: "<p>The <code>src</code> member of a term is an <code>ecs_term_ref_t</code>, and so are <code>first</code> and <code>second</code> — the same little struct describes all three corners of a term. A source can be:</p><ul><li><strong>The <code>$this</code> variable</strong> (the default). All terms with a <code>$this</code> source must match on the <em>same</em> entity — that's what makes &quot;has Position <em>and</em> Velocity&quot; mean one entity with both.</li><li><strong>A fixed entity</strong>, set with <code>.src.id = Game</code> or by name with <code>.src.name = &quot;Game&quot;</code>. Great for singletons and global state: every result carries the Game entity's component alongside the per-entity data.</li><li><strong>A named variable</strong> like <code>$planet</code>, written as <code>.src.name = &quot;planet&quot;</code> with the <code>EcsIsVariable</code> flag, or just <code>Planet($planet)</code> in the query language. The query fills the variable in as it searches.</li></ul>"
      },
      {
        type: "struct",
        heading: "The reference struct",
        name: "ecs_term_ref_t",
        summary: "Describes one corner of a term (src, first or second): either a concrete entity, or a variable to be resolved.",
        members: [
          { name: "id", type: "ecs_entity_t", desc: "The entity id, possibly combined with flags in its top bits: EcsSelf/EcsUp/EcsCascade/EcsDesc for traversal, and EcsIsEntity/EcsIsVariable/EcsIsName to say what kind of reference this is. Left fully zero, it becomes $this." },
          { name: "name", type: "const char *", desc: "A name instead of an id: an entity name to look up, or a variable name when the EcsIsVariable flag is set." }
        ]
      },
      {
        type: "code",
        heading: "Mixing $this and a fixed source",
        lang: "c",
        title: "Per-entity data plus one shared clock",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity) },\n    { ecs_id(SimTime), .src.id = Game }\n  }\n});\n\necs_iter_t it = ecs_query_iter(world, q);\nwhile (ecs_query_next(&it)) {\n  Position *p = ecs_field(&it, Position, 0);\n  Velocity *v = ecs_field(&it, Velocity, 1);\n  SimTime *st = ecs_field(&it, SimTime, 2);\n\n  for (int i = 0; i < it.count; i++) {\n    p[i].x += v[i].x * st->value;\n    p[i].y += v[i].y * st->value;\n  }\n}"
      },
      {
        type: "text",
        heading: "Fine print",
        html: "<p>Things to know when sources get fancy:</p><ul><li>A fixed-source field is <em>one</em> value, not an array — note <code>st-&gt;value</code> above, no <code>[i]</code>. Use <code>ecs_field_src(&amp;it, 2)</code> to learn which entity a field came from; it returns 0 when the field lives on the matched entities themselves.</li><li><code>it.entities</code> and <code>it.count</code> only cover entities matched by <code>$this</code>. A query with <em>only</em> fixed sources yields a result with <code>count == 0</code> — your inner loop won't run, so handle that case explicitly.</li><li>Terms with a fixed source default to <code>[in]</code> access, nudging you toward only writing data the matched entity owns.</li><li>The first/second corners can be variables too: <code>Serializable($component), $component($this)</code> finds every component on an entity that is itself marked Serializable.</li></ul>"
      }
    ],
    related: ["qry-variables", "qry-fields", "qry-traversal"]
  },
  {
    id: "qry-traversal",
    parent: "qry-anatomy",
    order: 4,
    title: "Traversal",
    code: "QRY-01D",
    tagline: "If you don't have it, ask your parents",
    intro: "Traversal lets a term look for a component <em>up a relationship</em>: if the entity doesn't have it, check its parent, then the grandparent, and so on. It's how a transform system finds the parent's Transform, and how entities appear to &quot;have&quot; components they inherit from a prefab.",
    sections: [
      {
        type: "text",
        heading: "The traversal flags",
        html: "<p>Traversal is configured on the term's <em>source</em> by combining flags into <code>src.id</code>, plus the relationship to walk in <code>trav</code>:</p><ul><li><code>EcsSelf</code> / <code>self</code> — look on the entity itself only.</li><li><code>EcsUp</code> / <code>up</code> — don't look on the entity; walk the relationship upwards until an entity with the component is found, or a root is reached.</li><li><code>EcsSelf|EcsUp</code> / <code>self|up</code> — try the entity first, then walk up.</li><li><code>EcsCascade</code> / <code>cascade</code> — like up, but results are returned parents-before-children (breadth-first). Perfect for transform systems, where a parent must be updated before its children read from it.</li><li><code>EcsDesc</code> / <code>desc</code> — combined with cascade, flips the order to children-before-parents.</li></ul><p>The walk is depth-first and stops at the first entity that has the component. The relationship must have the <code>Traversable</code> trait — <code>ChildOf</code> and <code>IsA</code> have it out of the box — which also guards against endless loops through cyclic relationships. When you set <code>up</code> without naming a relationship, it defaults to <code>ChildOf</code>.</p>"
      },
      {
        type: "diagram",
        heading: "Walking up a hierarchy",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "c", label: "turret", sub: "matched entity: no Transform" } ],
            [ { id: "p", label: "tank", sub: "parent: no Transform" } ],
            [ { id: "g", label: "platoon", sub: "grandparent: has Transform" } ],
            [ { id: "r", label: "result", sub: "field source = platoon" } ]
          ],
          edges: [
            { from: "c", to: "p", label: "up ChildOf" },
            { from: "p", to: "g", label: "up ChildOf" },
            { from: "g", to: "r", label: "found, stop" }
          ],
          note: "Term: Transform(up). The query keeps climbing until it finds the component or runs out of parents. The entity where it was found is reported in it.sources."
        }
      },
      {
        type: "code",
        heading: "Position on self, Transform from the parent",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Transform) },\n    { ecs_id(Transform), .src.id = EcsCascade, .trav = EcsChildOf }\n  }\n});"
      },
      {
        type: "text",
        heading: "Inheritance is traversal too",
        html: "<p>When a component has the <code>(OnInstantiate, Inherit)</code> trait, plain terms for it silently become <code>self|up</code> over the <code>IsA</code> relationship. That's the whole magic behind prefab inheritance: a query for <code>Style</code> finds the Style stored on the prefab your entity <code>IsA</code>-points to. Add an explicit <code>self</code> to switch that off. And even when you traverse a different relationship like <code>ChildOf</code>, each entity visited along the way is still checked for inherited components.</p><p>Gotchas worth knowing:</p><ul><li><code>cascade</code> and <code>desc</code> require a cached query (cascade is implemented with cache grouping by hierarchy depth).</li><li>Components matched through traversal default to <code>[in]</code> access — they're shared, so writing them is opt-in.</li><li>Cached queries that traverse can trigger <em>rematching</em>, which has a cost — see the cached queries deck.</li></ul>"
      }
    ],
    related: ["qry-rematching", "qry-grouping", "components", "lifecycle"]
  },
  {
    id: "qry-language",
    parent: "queries",
    order: 2,
    title: "The Flecs Query Language",
    code: "QRY-02",
    tagline: "Whole queries in one line of text",
    intro: "The Flecs Query Language is a tiny text format for writing queries: <code>&quot;Position, !Velocity, (Likes, $friend)&quot;</code>. It says nothing the C descriptor can't say — every piece of syntax maps straight onto a term — but text is easy to type, store in files, and send over a network.",
    sections: [
      {
        type: "text",
        heading: "The syntax in five minutes",
        html: "<p>An expression is a comma-separated list of terms. Each bit of punctuation sets one member of the corresponding <code>ecs_term_t</code>:</p><ul><li><code>Position</code> — must have Position. <code>(Likes, Bob)</code> — must have the pair.</li><li><code>!Velocity</code> not, <code>?Velocity</code> optional, <code>Velocity || Speed</code> or, <code>and|MyType</code> / <code>or|MyType</code> / <code>not|MyType</code> for the *From operators.</li><li><code>[in] Velocity</code> — access modifiers in square brackets.</li><li><code>SimTime(Game)</code> — explicit source in parentheses; <code>Likes($this, Bob)</code> is the fully spelled-out pair form. Names starting with <code>$</code> are variables; a bare name is an entity looked up at query creation.</li><li><code>Transform(up ChildOf)</code>, <code>Transform(cascade)</code>, <code>Style(self|up)</code> — traversal flags inside the source parentheses.</li><li><code>(Likes, *)</code> — wildcard, one result per matching pair; <code>(Likes, _)</code> — the <em>any</em> wildcard, at most one result no matter how many pairs match.</li><li><code>$this == UssEnterprise</code>, <code>$this ~= &quot;Uss&quot;</code> — equality and fuzzy-name predicates; <code>!{ ... }</code> — a negated scope over several terms; <code>$this.cockpit</code> — a lookup of a named child relative to a variable.</li></ul>"
      },
      {
        type: "code",
        heading: "The same query, twice",
        lang: "c",
        title: "expr and terms produce identical queries",
        src: "ecs_query_t *q1 = ecs_query(world, {\n  .expr = \"Position, [in] Velocity, !Frozen\"\n});\n\necs_query_t *q2 = ecs_query(world, {\n  .terms = {\n    { ecs_id(Position) },\n    { ecs_id(Velocity), .inout = EcsIn },\n    { ecs_id(Frozen), .oper = EcsNot }\n  }\n});"
      },
      {
        type: "code",
        heading: "A query with variables",
        lang: "c",
        title: "Spaceships docked to planets",
        src: "ecs_query_t *q = ecs_query(world, {\n  .expr = \"SpaceShip, (DockedTo, $planet), Planet($planet)\"\n});"
      },
      {
        type: "text",
        heading: "Where the language shows up",
        html: "<p>Because it's just a string, the query language works anywhere text works:</p><ul><li><strong>C macros</strong>: <code>ECS_SYSTEM(world, Move, EcsOnUpdate, Position, [in] Velocity)</code> — the part after the phase is a query expression.</li><li><strong>The <code>expr</code> member</strong> of <code>ecs_query_desc_t</code>, as above.</li><li><strong>Flecs Script</strong> uses the same expressions for queries inside scripts.</li><li><strong>The REST API and Explorer</strong>: the browser tool sends query strings to your live game and shows the results — the language is what makes runtime, tooling and modding queries possible, since strings can be built when the set of components isn't known at compile time.</li></ul>"
      }
    ],
    related: ["qry-anatomy", "qry-variables", "script", "remote"]
  },
  {
    id: "qry-cached",
    parent: "queries",
    order: 3,
    title: "Cached Queries",
    code: "QRY-03",
    tagline: "A saved answer that updates itself",
    intro: "A cached query does its searching <em>once</em>, writes down the list of matching tables, and afterwards just reads the list. Like a librarian who keeps a card titled &quot;all books about dragons&quot; and updates the card whenever a shelf changes, instead of walking the aisles for every visitor.",
    sections: [
      {
        type: "text",
        heading: "What exactly is cached",
        html: "<p>Flecs groups entities with identical component sets into <em>tables</em> (archetypes). A query doesn't match entities one by one — it matches whole tables. And while entities move between tables all the time, the set of tables itself is small and stable: most games settle on a fixed set of component combinations soon after loading.</p><p>That makes the cache cheap and powerful: it's a list of matched tables (each entry remembering where in the table each field's column lives, plus resolved ids and sources for traversal matches). Iterating a cached query is just walking this list — no searching at all. The cache stays current by observing table creation and deletion: each new table is tested once against the query, ever.</p><p>Internally the cache runs a <em>cache query</em> derived from yours: terms that can't be cached are left out (the leftovers are evaluated on the fly each iteration, mapped back through a field map), and fully trivial caches — no wildcards, no traversal, only And/Not/Optional — use a slimmer storage format and a faster iterator.</p>"
      },
      {
        type: "diagram",
        heading: "The cache is a list of tables",
        spec: {
          type: "grid",
          title: "Cache of query: Position, Velocity",
          cols: ["Cache entry", "Table (archetype)", "Entities", "Position column", "Velocity column"],
          rows: [
            ["0", "[Position, Velocity]", "1,204", "0", "1"],
            ["1", "[Position, Velocity, Mass]", "310", "0", "1"],
            ["2", "[Position, Velocity, Turret]", "12", "0", "1"]
          ],
          note: "Iteration walks these rows and hands you each table's arrays directly. A new table [Position, Velocity, Shield] would be matched once, on creation, and appended."
        }
      },
      {
        type: "text",
        heading: "The four cache kinds",
        html: "<p>The <code>cache_kind</code> member picks the policy:</p><ul><li><code>EcsQueryCacheDefault</code> — decide from context: cached if the query is associated with an entity (which is why <strong>system queries are cached by default</strong>), uncached otherwise.</li><li><code>EcsQueryCacheAuto</code> — cache every term that can be cached; the rest is evaluated live. Cacheable: plain components, tags and pairs, <code>$this</code> sources, wildcards, operators, traversal.</li><li><code>EcsQueryCacheAll</code> — insist that everything is cacheable, or fail query creation. Requires the <code>FLECS_CACHED_QUERIES</code> addon.</li><li><code>EcsQueryCacheNone</code> — never cache.</li></ul><p>The tradeoff: caches make iteration very fast but cost memory, make query creation slower, and add a little work to every table creation and deletion. Rule of thumb — queries that run every frame (systems) should be cached; ad-hoc, create-and-throw-away queries should not.</p>"
      },
      {
        type: "code",
        heading: "Requesting a cached query",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = { { ecs_id(Position) }, { ecs_id(Velocity) } },\n  .cache_kind = EcsQueryCacheAuto\n});"
      },
      {
        type: "text",
        heading: "What lives below this deck",
        html: "<p>The cache enables features that need somewhere to keep state: <strong>rematching</strong> keeps traversal results honest when parents change, <strong>change detection</strong> tracks which tables were touched, and <strong>sorting</strong> and <strong>grouping</strong> keep results in a chosen order. Each has its own page below.</p>"
      }
    ],
    related: ["qry-uncached", "qry-rematching", "qry-change-detection", "qry-sorting", "qry-grouping", "storage", "systems"]
  },
  {
    id: "qry-rematching",
    parent: "qry-cached",
    order: 1,
    title: "Rematching",
    code: "QRY-03A",
    tagline: "When the cache's answer goes stale",
    intro: "A cache entry normally only depends on the matched table itself, so it never goes stale. But a query that matched a component <em>through traversal</em> — on a parent, or an inherited prefab — depends on an entity outside the table. When that entity changes, the cached answer can be wrong, and Flecs must re-check it. That re-check is rematching.",
    sections: [
      {
        type: "text",
        heading: "When it happens",
        html: "<p>Only queries that use <code>up</code> or <code>cascade</code> traversal (including the implicit <code>self|up IsA</code> that inheritable components get) can need rematching. Triggers include:</p><ul><li>A parent (or other traversal target) adds or removes the matched component — say the <code>Transform</code> your children matched via <code>up</code> disappears.</li><li>An entity's <code>IsA</code> target changes, so the set of inherited components changes.</li><li>Hierarchy changes that alter which entity a traversal ends at.</li></ul><p>The machinery: the world keeps <em>component monitors</em> for components matched by traversal queries. Writes to a monitored component set a dirty flag; when the flags are evaluated, every query registered with that monitor re-runs matching for the affected tables and updates its cache entries (each entry carries a <code>rematch_count</code> to track this).</p>"
      },
      {
        type: "diagram",
        heading: "From parent change to fresh cache",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "a", label: "Parent changes", sub: "removes Transform" } ],
            [ { id: "b", label: "Component monitor", sub: "marked dirty" } ],
            [ { id: "c", label: "Monitors evaluated", sub: "queries flagged for rematch" } ],
            [ { id: "d", label: "Rematch", sub: "cache entries re-validated" } ]
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "c" },
            { from: "c", to: "d" }
          ],
          note: "Between the change and the rematch, the cache would have handed out a pointer to a component that is no longer there — rematching closes that gap."
        }
      },
      {
        type: "text",
        heading: "What it costs, and what to do about it",
        html: "<p>Rematching re-evaluates matched tables, so its cost grows with the number of archetypes and the number of traversal queries — in a world with many of both, it can show up as real frame time whenever hierarchies churn.</p><ul><li><strong>Measure first.</strong> Import the stats module and open the world statistics page in the Explorer; rematch counts are tracked there.</li><li><strong>If it hurts</strong>, make the traversal queries uncached: iteration gets slower, but the rematch cost disappears entirely, since uncached queries recompute traversal fresh every time.</li><li><strong>Keep hierarchies calm.</strong> Rematching only fires when traversal targets change, so stable parent/prefab structures never pay it.</li></ul><p>The Flecs docs are candid that rematching is a stopgap: it works, but a cheaper mechanism is planned. Until then, it's the one cost of cached traversal queries worth keeping an eye on.</p>"
      }
    ],
    related: ["qry-traversal", "qry-cached", "observability", "lifecycle"]
  },
  {
    id: "qry-change-detection",
    parent: "qry-cached",
    order: 2,
    title: "Change Detection",
    code: "QRY-03B",
    tagline: "Skip the tables where nothing happened",
    intro: "Change detection lets a query ask &quot;did anything I care about change since I last looked?&quot; — and skip entire tables of untouched entities. It's a sticky note on each drawer of the filing cabinet: if nobody moved the note, don't open the drawer.",
    sections: [
      {
        type: "text",
        heading: "Dirty counters per table column",
        html: "<p>Tracking every entity would be expensive, so Flecs tracks changes per <em>table, per component column</em>: each tracked table keeps a list of counters — one per component, plus one for entities joining or leaving the table. Any change bumps the matching counter.</p><p>A query with change detection keeps its own copy of those counters (a <em>monitor</em>) for every cached table. &quot;Has anything changed?&quot; is then just comparing numbers; iterating a table syncs the copy, resetting its changed state. Counters are only maintained on tables matched by at least one change-detecting query, so nobody else pays for the feature. It requires a cached query and the <code>FLECS_CACHED_QUERIES</code> addon.</p><p>What bumps the counters: adding/removing components, deleting entities, <code>ecs_set</code>, an explicit <code>ecs_modified</code>, and — importantly — <em>being iterated by a query with <code>inout</code> or <code>out</code> terms</em>. What doesn't: writing through a pointer from <code>ecs_ensure</code> or a cached ref without calling <code>ecs_modified</code>. Flecs can't see raw pointer writes.</p>"
      },
      {
        type: "code",
        heading: "The API",
        lang: "c",
        title: "ecs_query_changed, ecs_iter_changed, ecs_iter_skip",
        src: "ecs_query_t *q = ecs_query(world, {\n  .terms = {{ ecs_id(Position), .inout = EcsIn }},\n  .flags = EcsQueryDetectChanges\n});\n\nbool any = ecs_query_changed(q);\n\necs_iter_t it = ecs_query_iter(world, q);\nwhile (ecs_query_next(&it)) {\n  if (!ecs_iter_changed(&it)) {\n    ecs_iter_skip(&it);\n    continue;\n  }\n  Position *p = ecs_field(&it, Position, 0);\n  for (int i = 0; i < it.count; i++) {\n  }\n}"
      },
      {
        type: "text",
        heading: "Rules of the road",
        html: "<p>Three habits make change detection work well:</p><ul><li><strong>Read with <code>[in]</code>.</strong> A change-detecting query with <code>inout</code>/<code>out</code> terms marks components dirty just by iterating, so it would always see itself as changed. Read-only terms don't.</li><li><strong>Skip honestly.</strong> A writing query that decides not to modify a table should call <code>ecs_iter_skip</code> — otherwise the table's counters are bumped anyway, since Flecs assumes an unskipped <code>inout</code>/<code>out</code> iteration wrote something.</li><li><strong>Changed state is per table</strong> and stays set until that table is iterated by the detecting query, so per-table reactions (recompute a bounding box, re-upload a mesh) fall out naturally from the <code>ecs_iter_changed</code> check.</li></ul>"
      }
    ],
    related: ["qry-access", "qry-sorting", "qry-cached"]
  },
  {
    id: "qry-sorting",
    parent: "qry-cached",
    order: 3,
    title: "Sorting",
    code: "QRY-03C",
    tagline: "Results in order, resorted only when needed",
    intro: "A sorted query returns entities in an order you define — nearest first, lowest depth first — by giving the query a compare function. Sorting is done ahead of time and remembered; iteration stays fast because the query re-sorts only when change detection says the data moved.",
    sections: [
      {
        type: "code",
        heading: "Creating a sorted query",
        lang: "c",
        title: "order_by picks the component, the callback compares",
        src: "int compare_depth(ecs_entity_t e1, const void *v1,\n                  ecs_entity_t e2, const void *v2) {\n  const Depth *d1 = v1;\n  const Depth *d2 = v2;\n  return (d1->value > d2->value) - (d1->value < d2->value);\n}\n\necs_query_t *q = ecs_query(world, {\n  .terms = {\n    { ecs_id(Depth), .inout = EcsIn }\n  },\n  .order_by = ecs_id(Depth),\n  .order_by_callback = compare_depth\n});"
      },
      {
        type: "text",
        heading: "How sorting works: sort, then slice",
        html: "<p>Results can be spread over many tables, and sorted order may interleave them — the entity with the 3rd-smallest depth might live in a different table than the 2nd. Flecs handles this in two steps, both using quicksort:</p><ol><li><strong>Sort each table</strong> that changed, in place, by your compare function.</li><li><strong>Compute slices</strong>: walk the sorted tables to build an ordered list of runs — &quot;entities 0–2 of table A, then 3–4 of table B, then 5 of table C, then 6–7 of table A again&quot;. Iteration then just plays the slices back.</li></ol><p>The whole result is cached; iterating an already-sorted query costs about the same as a normal one. When an iterator is created, the query consults change detection: untouched data means no work at all.</p><p>Leave <code>order_by</code> at zero and the callback receives only entity ids — an easy way to iterate in creation order. And a neat trick: sorting on a component matched through <em>traversal</em> (e.g. from a parent) can order whole tables at once, since every entity in the table shares the value.</p>"
      },
      {
        type: "text",
        heading: "When re-sorts trigger, and how to avoid them",
        html: "<ul><li>A re-sort is considered whenever an iterator is created, and happens only for tables whose sorted component (or membership) changed since last time.</li><li><strong>Mark the sort component <code>[in]</code>.</strong> If the sorted query can write it, every iteration invalidates its own order — a treadmill of re-sorts.</li><li><strong>Avoid rival sorted queries</strong> that order the same tables differently; each one's sort invalidates the other's, forcing a re-sort per iterator.</li><li>The slicing step scans matched tables repeatedly, so sorting queries that match many tables with frequently-changing data is the worst case. For coarse ordering, <em>grouping</em> is far cheaper.</li></ul>"
      }
    ],
    related: ["qry-change-detection", "qry-grouping", "qry-performance"]
  },
  {
    id: "qry-grouping",
    parent: "qry-cached",
    order: 4,
    title: "Grouping",
    code: "QRY-03D",
    tagline: "Buckets of tables, iterable one bucket at a time",
    intro: "Grouping gives every matched table a number — a <em>group id</em> — and stores tables with the same number together in the cache. You can then iterate everything bucket by bucket in ascending order, or jump straight to one bucket: &quot;just the entities in the world cell near the player, please&quot;.",
    sections: [
      {
        type: "text",
        heading: "How groups work",
        html: "<p>You supply a <code>group_by_callback</code> that computes a 64-bit id from a table's components — for example, the target of a <code>(Region, *)</code> pair. Because the id depends only on the table's type, it's computed once per table, when the table enters the cache.</p><p>The cache keeps one list of tables per group and an index mapping group id to its list, so inserting a table is constant-time and groups stay sorted by id. That makes grouping the <em>coarsest, cheapest</em> ordering tool Flecs has: no entities are compared, no tables are sorted — real sorting only happens in the sense that a brand-new group id must be slotted into place, which is rare. Group ids are local to the query; the tables themselves are untouched, so different queries can group the same tables differently.</p><p>Two hooks let you attach state: <code>on_group_create</code> runs when a group id first appears (its return value becomes the group's context), <code>on_group_delete</code> when its last table leaves. Combine grouping with sorting and grouping wins: tables are bucketed first, then each bucket is sorted internally.</p>"
      },
      {
        type: "diagram",
        heading: "A grouped cache",
        spec: {
          type: "grid",
          title: "Query: Unit, grouped by (Region, *) target",
          cols: ["Group id", "Tables in group", "Iterated"],
          rows: [
            ["Region_01", "[Unit, (Region,Region_01)], [Unit, Turret, (Region,Region_01)]", "1st"],
            ["Region_02", "[Unit, (Region,Region_02)]", "2nd"],
            ["Region_03", "[Unit, Ghost, (Region,Region_03)]", "3rd"]
          ],
          note: "Groups are iterated in ascending group id order. ecs_iter_set_group jumps the iterator to exactly one bucket."
        }
      },
      {
        type: "code",
        heading: "Group by region, iterate one region",
        lang: "c",
        src: "uint64_t group_by_target(ecs_world_t *world, ecs_table_t *table,\n    ecs_id_t id, void *ctx)\n{\n  ecs_id_t pair = 0;\n  if (ecs_search(world, table, ecs_pair(id, EcsWildcard), &pair) != -1) {\n    return ecs_pair_second(world, pair);\n  }\n  return 0;\n}\n\necs_query_t *q = ecs_query(world, {\n  .terms = {{ Unit }},\n  .group_by = Region,\n  .group_by_callback = group_by_target\n});\n\necs_iter_t it = ecs_query_iter(world, q);\necs_iter_set_group(&it, Region_01);\nwhile (ecs_query_next(&it)) {\n}"
      },
      {
        type: "text",
        heading: "Why this is a big deal",
        html: "<p>Group iteration with <code>ecs_iter_set_group</code> gives you the speed of a dedicated cached query <em>per bucket</em> without maintaining a cache per bucket. Whether a group holds ten tables or ten thousand doesn't matter — the iterator walks only that group's list. Classic uses: world cells in an open world (only process cells near the player), day/night entity sets, editor-only entities.</p><p>Flecs itself runs on this feature: <code>cascade</code> traversal is grouping with hierarchy-depth as the group id, and the pipeline groups systems by their depth in the <code>DependsOn</code> tree, sorted by entity id within each group.</p>"
      }
    ],
    related: ["qry-sorting", "qry-traversal", "systems"]
  },
  {
    id: "qry-uncached",
    parent: "queries",
    order: 4,
    title: "Uncached Queries",
    code: "QRY-04",
    tagline: "Search fresh every time, own nothing",
    intro: "An uncached query keeps no list of results — every time you iterate it, it searches the world from scratch. That makes it nearly free to create and free to keep around, which is exactly what you want for one-off questions like &quot;which entities are children of this parent, right now?&quot;.",
    sections: [
      {
        type: "text",
        heading: "When fresh beats fast",
        html: "<p>Uncached queries are the mirror image of cached ones:</p><ul><li><strong>Creation is cheap</strong> — no cache to build — so ad-hoc, create-use-destroy queries are fine.</li><li><strong>No memory or bookkeeping</strong>: they're stateless, and add zero overhead to table creation/deletion.</li><li><strong>Iteration costs more</strong>: the query engine searches for matching tables on every iteration, guided by the world's component index (for each component, the list of tables that contain it — the engine starts from the rarest term and checks candidates against the rest).</li><li><strong>No rematching, ever</strong>: traversal results are computed fresh each time, which is also the escape hatch when cached traversal queries suffer rematch storms.</li></ul><p>You get an uncached query with <code>.cache_kind = EcsQueryCacheNone</code>, or simply by creating a query without an associated entity — the Default policy makes entity-less queries uncached. Features that need somewhere to store state — change detection, sorting, grouping, <code>cascade</code> — are cached-only.</p>"
      },
      {
        type: "code",
        heading: "The ecs_each fast path",
        lang: "c",
        title: "One component, minimum machinery",
        src: "ecs_iter_t it = ecs_each(world, Position);\nwhile (ecs_each_next(&it)) {\n  Position *p = ecs_field(&it, Position, 0);\n  for (int i = 0; i < it.count; i++) {\n    p[i].x += 1;\n  }\n}\n\necs_iter_t cit = ecs_children(world, parent);\nwhile (ecs_children_next(&cit)) {\n  for (int i = 0; i < cit.count; i++) {\n  }\n}"
      },
      {
        type: "text",
        heading: "How an uncached query runs",
        html: "<p>For the simplest ask — all entities with one component or pair — <code>ecs_each_id</code> skips query creation entirely and walks the component index directly; <code>ecs_children</code> is the same trick for <code>(ChildOf, parent)</code>. Much lighter than building even an uncached query.</p><p>Everything richer goes through real machinery: when the query is created, a <em>compiler</em> turns the terms into a small program (the query plan), and each iteration a <em>virtual machine</em> — a little program-runner inside Flecs — executes that plan against the world. Cached queries use the same VM with a plan that mostly just reads the cache; for fully-cached trivial queries the plan is empty and the VM is bypassed altogether. The next two pages open up the compiler and the VM.</p>"
      }
    ],
    related: ["qry-compiler", "qry-vm", "qry-cached", "storage"]
  },
  {
    id: "qry-compiler",
    parent: "qry-uncached",
    order: 1,
    title: "The Query Compiler",
    code: "QRY-04A",
    tagline: "From checklist to step-by-step search plan",
    intro: "When you create a query, Flecs doesn't store your terms as-is — it <em>compiles</em> them into a plan: an ordered list of small instructions that say exactly how to search. Like turning a shopping list into an efficient route through the store, aisle by aisle.",
    sections: [
      {
        type: "diagram",
        heading: "The compile pipeline",
        spec: {
          type: "stack",
          layers: [
            { label: "Descriptor", sub: "terms array and/or expr string" },
            { label: "Parser", sub: "expr text becomes terms (if used)" },
            { label: "Validator / finalizer", sub: "fill defaults, resolve names, assign fields, check errors" },
            { label: "Cache split", sub: "cacheable terms peel off into the cache query" },
            { label: "Compiler", sub: "discover variables, emit one or more instructions per term" },
            { label: "Query plan", sub: "array of instructions, ending in yield" }
          ],
          note: "Implemented in src/query/: validator.c, cache/, compiler/. The plan is evaluated by the engine in src/query/engine/."
        }
      },
      {
        type: "text",
        heading: "What each stage does",
        html: "<p><strong>Validation</strong> (the <em>finalizer</em>) is where your shorthand becomes explicit: empty sources become <code>$this</code>, inheritable components get <code>self|up IsA</code> traversal, names are looked up to entity ids, access defaults are chosen, field indices are assigned (Or chains share one), and illegal combinations are rejected with an error.</p><p><strong>Compilation</strong> then walks the finalized terms and emits instructions:</p><ul><li>It first discovers all <em>variables</em> ($this, $planet, anonymous ones) and assigns them registers.</li><li>If the query has a cache, a single cache-search instruction replaces all cached terms — the plan just reads the list.</li><li>Runs of simple uncached terms are batched into one <code>triv</code> (trivial search) instruction.</li><li>Each remaining term becomes a matching instruction — <code>and</code>, <code>up</code>, <code>selfup</code>, <code>trav</code>, <code>sparse</code>, <code>toggle</code>... — chosen by the term's features, wrapped in control-flow instructions (<code>not</code>, <code>option</code>, <code>or</code>, <code>ifset</code>, <code>end</code>) as needed.</li><li>Housekeeping instructions (<code>setvars</code>, <code>setids</code>, <code>setfixed</code>) fill in the iterator's sources and ids, and a final <code>yield</code> hands the result to you.</li></ul><p>Term order matters: instructions run in roughly the order you wrote terms, and each instruction only sees candidates that survived the previous ones. Putting your rarest term first shrinks the search most.</p>"
      },
      {
        type: "code",
        heading: "Print the plan",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .expr = \"Position, !Velocity\",\n  .cache_kind = EcsQueryCacheNone\n});\n\nchar *plan = ecs_query_plan(q);\nprintf(\"%s\\n\", plan);\necs_os_free(plan);"
      },
      {
        type: "code",
        heading: "What it prints",
        lang: "bash",
        title: "Real output for the query above",
        src: " 0. [-1,  1]  setids\n 1. [ 0,  2]  and          $[this]          (Position)\n 2. [ 1,  4]  not\n 3. [ 2,  4]   and         $[this]          (Velocity)\n 4. [ 2,  5]  end          $[this]          (Velocity)\n 5. [ 4,  6]  yield"
      },
      {
        type: "text",
        heading: "Reading a plan",
        html: "<p>Each line is one instruction: its index, then <code>[prev, next]</code> — where control jumps on failure and success — then the instruction name, the source it matches against (<code>$[this]</code> means the $this variable holding a whole table), and the component in parentheses. Here: find tables with Position; inside the <code>not</code>...<code>end</code> block, try to find Velocity on the candidate — if that <em>succeeds</em> the block fails the candidate; survivors reach <code>yield</code>.</p><p><code>ecs_query_plan_w_profile</code> adds per-instruction hit counts from an iterator, and <code>ecs_query_plans</code> also prints the cache query's plan. A fully cached trivial query has an <em>empty</em> plan — its iterator walks the cache without the VM. Requires the <code>FLECS_QUERY_PLANS</code> addon, and it's the first tool to reach for when a query is slow or returns something surprising.</p>"
      }
    ],
    related: ["qry-vm", "qry-anatomy", "qry-performance", "internals"]
  },
  {
    id: "qry-vm",
    parent: "qry-uncached",
    order: 2,
    title: "The Query VM",
    code: "QRY-04B",
    tagline: "A tiny machine that searches by trial and error",
    intro: "The query engine is a small virtual machine: it runs the compiled plan one instruction at a time, moving <em>forward</em> when an instruction finds a match and <em>backward</em> when one comes up empty — asking the earlier instruction for its next candidate. This forward-backward dance is how one simple loop can answer arbitrarily clever queries.",
    sections: [
      {
        type: "text",
        heading: "Instructions that can answer twice",
        html: "<p>The key idea: every instruction is a little generator that can be asked two things, controlled by a <code>redo</code> flag:</p><ul><li><strong>First time</strong> (<code>redo = false</code>): produce your first match — e.g. the <code>and</code> instruction looks up the component's record and returns the first table containing it.</li><li><strong>Again</strong> (<code>redo = true</code>): produce your <em>next</em> match — the next table, the next column of a wildcard, the next entity.</li></ul><p>The evaluation loop (in <code>src/query/engine/eval.c</code>) is just: run the current instruction; if it succeeded, step to its <code>next</code> label; if it failed, fall back to its <code>prev</code> label — and whenever control moves backward, the instruction re-entered runs with <code>redo</code> set, so it advances instead of restarting. Falling back past the first instruction means the search is over.</p>"
      },
      {
        type: "diagram",
        heading: "One evaluation step",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "op", label: "Run instruction", sub: "with redo flag" } ],
            [ { id: "ok", label: "Matched", sub: "go to next label" },
              { id: "no", label: "No match", sub: "back to prev label, redo = true" } ],
            [ { id: "y", label: "yield reached", sub: "hand result to app" },
              { id: "prev", label: "Earlier instruction", sub: "produces its next candidate" } ],
            [ { id: "resume", label: "ecs_query_next", sub: "resumes at yield with redo" } ]
          ],
          edges: [
            { from: "op", to: "ok" },
            { from: "op", to: "no" },
            { from: "ok", to: "y" },
            { from: "no", to: "prev", label: "backtrack" },
            { from: "prev", to: "op", dashed: true, label: "try again" },
            { from: "y", to: "resume", dashed: true }
          ],
          note: "Reaching yield doesn't end the search — it pauses it. The next ecs_query_next call backtracks from yield to enumerate the next result."
        }
      },
      {
        type: "text",
        heading: "The instruction set, by family",
        html: "<p>The op kinds live in <code>src/query/types.h</code>; the important families:</p><ul><li><strong>Searching</strong>: <code>and</code> (find or verify a component; when the source table is unknown it iterates the component's table list, when known it just checks), <code>triv</code> (a batch of simple terms in one go), <code>cache</code>/<code>iscache</code> (read the query cache), <code>with</code> (check a fixed/variable source).</li><li><strong>Traversal</strong>: <code>up</code>, <code>selfup</code> (walk a relationship upwards, with caches for hierarchies), <code>trav</code> (transitive/reflexive relationships), the <code>tree</code> family for <code>ChildOf</code>.</li><li><strong>Wildcards over ids</strong>: <code>ids</code>, <code>idsright</code>, <code>idsleft</code> — enumerate which component ids matching <code>(R, *)</code> or <code>(*, T)</code> exist at all.</li><li><strong>Control flow</strong>: <code>not</code>, <code>option</code>, <code>or</code>, <code>ifvar</code>, <code>ifset</code>, <code>end</code> — blocks that invert, allow, or conditionally skip inner instructions.</li><li><strong>Variables</strong>: <code>each</code> (split a matched table into individual entities, binding an entity variable), <code>store</code>, <code>reset</code>, <code>lookup</code> (find a named child), the <code>pred</code> family for <code>==</code>/<code>!=</code>/<code>~=</code>.</li><li><strong>Storage special cases</strong>: <code>toggle</code> (bitset-enabled components), <code>sparse</code> (sparse components).</li><li><strong>Bookkeeping</strong>: <code>setvars</code>, <code>setids</code>, <code>setfixed</code>, <code>setthis</code>, and finally <code>yield</code>.</li></ul><p>Because instructions stream tables — not entities — the expensive parts of matching stay batched: one <code>and</code> success can vouch for hundreds of entities at once, and <code>each</code> is only emitted when something genuinely needs per-entity treatment.</p>"
      },
      {
        type: "text",
        heading: "Watching it run",
        html: "<p>Each iterator keeps the VM's state between results: per-instruction context (where each generator left off), the variable registers, and the instruction index to resume at. In debug builds, <code>ecs_query_plan_w_profile(q, &amp;it)</code> prints the plan with two counters per instruction — how often it ran fresh and how often it was redone — which shows exactly where a slow query spends its effort.</p>"
      }
    ],
    related: ["qry-compiler", "qry-variables", "qry-iteration", "storage"]
  },
  {
    id: "qry-variables",
    parent: "qry-vm",
    order: 1,
    title: "Variables & Reification",
    code: "QRY-04B1",
    tagline: "Unknowns that lock in as the search proceeds",
    intro: "A query variable like <code>$planet</code> starts out meaning &quot;someone, we don't know who yet&quot;. As the VM finds matches, the variable gets <em>bound</em> — pinned to one concrete entity — and every later term must agree with that binding. If a later term can't, the VM backtracks, unpins the variable, and tries the next candidate. Solving for unknowns this way is called reification.",
    sections: [
      {
        type: "text",
        heading: "A worked example",
        html: "<p>Take <code>SpaceShip, (DockedTo, $planet), Planet($planet)</code> — ships docked to something that really is a planet:</p><ol><li>The <code>and</code> instruction for <code>SpaceShip</code> binds <code>$this</code> to a table of ships.</li><li>The instruction for <code>(DockedTo, $planet)</code> finds a DockedTo pair on those ships. Its target — say <code>Earth</code> — is written into <code>$planet</code>. The variable is now <em>bound</em>.</li><li><code>Planet($planet)</code> no longer searches anything: <code>$planet</code> is known, so it's a cheap check — does Earth have Planet?</li><li>If Earth isn't a Planet, control falls back to step 2 with <code>redo</code>: the pair instruction produces the ship's <em>next</em> DockedTo target, rebinding <code>$planet</code>. Out of targets? Fall back further to the next table of ships.</li></ol><p>Whether a term <em>searches</em> or merely <em>checks</em> is decided by what's bound when it runs — the compiler tracks this with a <code>written</code> bitset per instruction, so the plan is laid out to bind variables as early and cheaply as possible. This is also why term order can change performance: bind selective variables first, and later terms collapse into cheap checks.</p>"
      },
      {
        type: "text",
        heading: "Two shapes, and the tricks they enable",
        html: "<p>A variable can hold a whole <em>table range</em> (many entities at once — how <code>$this</code> usually travels, for speed) or a single <em>entity</em>. The VM keeps both forms and converts only when needed: the <code>each</code> instruction fans a table out into individual entities when some term — a parent lookup, an equality test — needs one at a time.</p><ul><li>Variables named with a leading underscore (<code>$_x</code>) are <em>anonymous</em>: they constrain matching but aren't returned.</li><li>Lookup variables like <code>$this.cockpit</code> resolve a named child of whatever the variable is bound to.</li><li>Terms that use a variable first bound inside an optional or Or branch only run when that branch actually bound it — free conditional logic.</li></ul>"
      },
      {
        type: "code",
        heading: "Reading and pre-binding variables",
        lang: "c",
        title: "ecs_iter_set_var turns a search into a lookup",
        src: "ecs_query_t *q = ecs_query(world, {\n  .expr = \"SpaceShip, (DockedTo, $planet), Planet($planet)\"\n});\n\nint planet_var = ecs_query_find_var(q, \"planet\");\n\necs_iter_t it = ecs_query_iter(world, q);\nwhile (ecs_query_next(&it)) {\n  ecs_entity_t planet = ecs_iter_get_var(&it, planet_var);\n  for (int i = 0; i < it.count; i++) {\n  }\n}\n\nit = ecs_query_iter(world, q);\necs_iter_set_var(&it, planet_var, earth);\nwhile (ecs_query_next(&it)) {\n}"
      },
      {
        type: "text",
        heading: "Why pre-binding is fast",
        html: "<p><code>ecs_iter_set_var</code> pins a variable <em>before</em> iteration starts. Every instruction that would have searched for <code>$planet</code> now just checks against your value — the query runs a much smaller search. One parameterized query (&quot;ships docked to $planet&quot;) can replace a whole family of specialized ones, created once and reused with different bindings. <code>$this</code> itself is variable zero, so the same trick can constrain a query to a single entity or table.</p>"
      }
    ],
    related: ["qry-vm", "qry-language", "qry-sources"]
  },
  {
    id: "qry-iteration",
    parent: "queries",
    order: 5,
    title: "Iterating: ecs_iter_t",
    code: "QRY-05",
    tagline: "The cursor that walks results, one table at a time",
    intro: "Whatever kind of query you run, results arrive through the same object: <code>ecs_iter_t</code>, a cursor over the matches. Each call to <code>ecs_query_next</code> advances it to the next batch — one table's worth of entities — and you loop over that batch with plain array indexing.",
    sections: [
      {
        type: "code",
        heading: "The canonical loop",
        lang: "c",
        title: "Outer loop: tables. Inner loop: entities.",
        src: "ecs_iter_t it = ecs_query_iter(world, q);\n\nwhile (ecs_query_next(&it)) {\n  Position *p = ecs_field(&it, Position, 0);\n  Velocity *v = ecs_field(&it, Velocity, 1);\n\n  for (int i = 0; i < it.count; i++) {\n    p[i].x += v[i].x;\n    p[i].y += v[i].y;\n  }\n}"
      },
      {
        type: "diagram",
        heading: "What one next() call yields",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "q", label: "ecs_query_next", sub: "advance the cursor" } ],
            [ { id: "t", label: "One result", sub: "table + count + fields" } ],
            [ { id: "e", label: "entities[]", sub: "who matched" },
              { id: "f", label: "field arrays", sub: "their component data" } ],
            [ { id: "l", label: "Your inner loop", sub: "for i in 0..count" } ]
          ],
          edges: [
            { from: "q", to: "t" },
            { from: "t", to: "e" },
            { from: "t", to: "f" },
            { from: "e", to: "l" },
            { from: "f", to: "l" }
          ],
          note: "Batching by table is why ECS iteration is fast: the arrays are contiguous, so compilers can vectorize the inner loop."
        }
      },
      {
        type: "text",
        heading: "Iterator etiquette",
        html: "<p>A few rules keep iteration safe and fast:</p><ul><li><strong>Run to completion or clean up.</strong> The final <code>next()</code> that returns false releases the iterator's resources. Breaking out early? Call <code>ecs_iter_fini(&amp;it)</code>.</li><li><strong>Don't restructure mid-iteration.</strong> Adding/removing components moves entities between tables, which would pull the rug out from under the cursor. Wrap changes in <code>ecs_defer_begin</code>/<code>ecs_defer_end</code> (systems defer automatically) — see the Prefabs &amp; Lifecycle deck.</li><li><strong>Generic code can use <code>ecs_iter_next</code></strong>, which works for any iterator kind (query, each, children...) at the cost of a function pointer call; <code>ecs_query_next</code> is the direct, faster path.</li><li>Inside a system you receive a ready-made <code>ecs_iter_t*</code> — same struct, same fields, no <code>ecs_query_iter</code> needed.</li></ul>"
      },
      {
        type: "struct",
        heading: "The iterator, every public field",
        name: "ecs_iter_t",
        summary: "The full state of an iteration. Systems and observers receive a pointer to one; manual iteration builds one on the stack.",
        members: [
          { name: "world", type: "ecs_world_t *", desc: "The world (or stage, when iterating during deferred/multithreaded execution) to use for operations from inside the loop." },
          { name: "real_world", type: "ecs_world_t *", desc: "The actual world, never a stage. Rarely needed directly." },
          { name: "offset", type: "int32_t", desc: "Where in the current table this batch starts. Usually 0; non-zero when a result covers part of a table (e.g. sorted slices)." },
          { name: "count", type: "int32_t", desc: "How many entities are in this batch — the bound of your inner loop. Zero when nothing matched $this (e.g. fixed-source-only queries)." },
          { name: "entities", type: "const ecs_entity_t *", desc: "The ids of the matched entities, parallel to the field arrays: entities[i] owns p[i]." },
          { name: "ptrs", type: "void **", desc: "Cached per-field data pointers, when available. ecs_field falls back to trs when a field's entry is empty; you should use ecs_field instead of reading this." },
          { name: "trs", type: "const ecs_table_record_t **", desc: "Per field, the record saying where in the table that field's column lives. The raw material ecs_field works from." },
          { name: "columns", type: "const int16_t *", desc: "Per field, the table column index the field was matched at." },
          { name: "sizes", type: "const ecs_size_t *", desc: "Per field, the component's size in bytes. Lets generic code walk data without knowing types." },
          { name: "table", type: "ecs_table_t *", desc: "The table this batch of entities lives in." },
          { name: "other_table", type: "ecs_table_t *", desc: "During add/remove events: the table the entities are coming from or going to." },
          { name: "ids", type: "ecs_id_t *", desc: "Per field, the component id that actually matched — how you learn what a wildcard resolved to." },
          { name: "sources", type: "ecs_entity_t *", desc: "Per field, the entity the component was matched on, or 0 when it's the matched entities themselves. Filled for fixed sources and traversal matches." },
          { name: "constrained_vars", type: "ecs_flags64_t", desc: "Bit per variable that was pinned with ecs_iter_set_var before iterating." },
          { name: "set_fields", type: "ecs_termset_t", desc: "Bit per field: is this field populated for the current result? Check via ecs_field_is_set (matters for optional terms)." },
          { name: "ref_fields", type: "ecs_termset_t", desc: "Bit per field that is a reference to a single value (shared/fixed source) rather than an array of count elements." },
          { name: "row_fields", type: "ecs_termset_t", desc: "Bit per field that must be fetched per entity with ecs_field_at (sparse components)." },
          { name: "up_fields", type: "ecs_termset_t", desc: "Bit per field that was matched on another entity through traversal (a parent or prefab)." },
          { name: "system", type: "ecs_entity_t", desc: "When run by a system: that system's entity. Zero otherwise." },
          { name: "event", type: "ecs_entity_t", desc: "When run by an observer: the event being delivered, like EcsOnAdd." },
          { name: "event_id", type: "ecs_id_t", desc: "When run by an observer: the component id the event is about." },
          { name: "event_cur", type: "int32_t", desc: "Sequence number of the current event, used to avoid delivering one event to the same observer twice." },
          { name: "field_count", type: "int8_t", desc: "Number of fields in each result. Can be lower than the term count, because an Or chain shares one field." },
          { name: "term_index", type: "int8_t", desc: "For observers: which term triggered the event." },
          { name: "query", type: "const ecs_query_t *", desc: "The query being iterated, if any." },
          { name: "param", type: "void *", desc: "The user pointer passed to ecs_run or ecs_emit — a way to hand arguments to a system for one invocation." },
          { name: "ctx", type: "void *", desc: "The system/query ctx pointer from the descriptor." },
          { name: "binding_ctx", type: "void *", desc: "Language-binding context of the system or query." },
          { name: "callback_ctx", type: "void *", desc: "Language-binding context for the callback." },
          { name: "run_ctx", type: "void *", desc: "Language-binding context for the run function." },
          { name: "delta_time", type: "ecs_ftime_t", desc: "Seconds since the last frame — what movement code multiplies by." },
          { name: "delta_system_time", type: "ecs_ftime_t", desc: "Seconds since this particular system last ran (differs from delta_time for systems on timers)." },
          { name: "frame_offset", type: "int32_t", desc: "How many entities were already yielded before this batch, across all results so far." },
          { name: "flags", type: "ecs_flags32_t", desc: "Iterator state flags, such as the skip mark set by ecs_iter_skip." },
          { name: "interrupted_by", type: "ecs_entity_t", desc: "Set this to stop iteration from inside a system; records who interrupted." },
          { name: "priv_", type: "ecs_iter_private_t", desc: "...internal: per-iterator-kind state (VM registers, cache cursor, etc.). Don't touch." },
          { name: "next", type: "ecs_iter_next_action_t", desc: "The function that advances this iterator — what ecs_iter_next calls through." },
          { name: "callback", type: "ecs_iter_action_t", desc: "The system or observer callback being invoked, when applicable." },
          { name: "fini", type: "ecs_iter_fini_action_t", desc: "The cleanup function ecs_iter_fini calls to release iterator resources." },
          { name: "chain_it", type: "ecs_iter_t *", desc: "For chained iterators: the underlying iterator this one wraps and filters." }
        ]
      }
    ],
    related: ["qry-fields", "qry-vm", "systems", "lifecycle"]
  },
  {
    id: "qry-fields",
    parent: "qry-iteration",
    order: 1,
    title: "Fields & ecs_field",
    code: "QRY-05A",
    tagline: "Getting your hands on the actual data",
    intro: "A <em>field</em> is one slot of data per result — usually an array with one element per entity in the batch. <code>ecs_field</code> is how you fetch it: give it the iterator, the type, and the field index, and it returns a typed pointer into the table's column.",
    sections: [
      {
        type: "text",
        heading: "Fields are not quite terms",
        html: "<p>Field indices start at 0 and follow term order — but they are <em>field</em> indices, not term indices. Two things make them diverge:</p><ul><li>An <strong>Or chain</strong> collapses into one field: in <code>Position, Velocity || Speed, Mass</code>, Mass is field 2, not 3.</li><li>Terms with <code>[none]</code>/<code>[filter]</code> access still occupy a field slot, but the field has no data to fetch.</li></ul><p><code>ecs_field(&amp;it, Position, 0)</code> is a macro over <code>ecs_field_w_size(&amp;it, sizeof(Position), 0)</code> — the size is double-checked in debug builds, catching mismatched indices early.</p>"
      },
      {
        type: "text",
        heading: "Not every field is an array",
        html: "<p>Three field shapes, and how to handle each:</p><ul><li><strong>Owned</strong> (the normal case): an array, index it with the entity index: <code>p[i]</code>.</li><li><strong>Shared</strong>: matched on <em>another</em> entity — a fixed source, a parent via traversal, an inherited prefab component. The field is a pointer to a single value: use <code>st-&gt;value</code>, not <code>st[i]</code>. Test with <code>ecs_field_is_self(&amp;it, idx)</code>, or check <code>it.sources[idx]</code> / <code>ecs_field_src</code>. Note that with <code>self|up</code> traversal the <em>same field of the same query</em> can be owned in one result and shared in the next — check per result.</li><li><strong>Per-row</strong>: sparse components don't live in table columns, so there's no array to return. These fields are flagged in <code>it.row_fields</code> and must be fetched per entity with <code>ecs_field_at(&amp;it, Velocity, idx, i)</code>.</li></ul>"
      },
      {
        type: "code",
        heading: "The field toolbox",
        lang: "c",
        title: "Inspecting what actually matched",
        src: "while (ecs_query_next(&it)) {\n  Position *p = ecs_field(&it, Position, 0);\n\n  if (ecs_field_is_set(&it, 1)) {\n    ecs_id_t what = ecs_field_id(&it, 1);\n    ecs_entity_t from = ecs_field_src(&it, 1);\n    size_t size = ecs_field_size(&it, 1);\n    bool owned = ecs_field_is_self(&it, 1);\n  }\n\n  for (int i = 0; i < it.count; i++) {\n    Velocity *v = ecs_field_at(&it, Velocity, 2, i);\n  }\n}"
      },
      {
        type: "text",
        heading: "When to use what",
        html: "<ul><li><code>ecs_field</code> — the data itself. Fetch once per result, outside the inner loop.</li><li><code>ecs_field_at</code> — the data for one entity; required for sparse fields.</li><li><code>ecs_field_id</code> — which id matched, essential with wildcards and Or (was it <code>(Likes, Cats)</code> or <code>(Likes, Dogs)</code>? Velocity or Speed?).</li><li><code>ecs_field_src</code> — which entity provided it (0 means the matched entities themselves).</li><li><code>ecs_field_is_set</code> — did this optional term match here at all?</li><li><code>ecs_field_size</code> — element size, for generic code that doesn't know the type.</li></ul>"
      }
    ],
    related: ["qry-iteration", "qry-operators", "qry-sources", "reflection"]
  },
  {
    id: "qry-performance",
    parent: "queries",
    order: 6,
    title: "Performance Guide",
    code: "QRY-06",
    tagline: "What's fast, what's slow, and which levers to pull",
    intro: "Query performance mostly comes down to three questions: is the query cached, how much can be matched per <em>table</em> instead of per entity, and how much searching does each iteration redo. This page collects the practical rules.",
    sections: [
      {
        type: "text",
        heading: "The big levers",
        html: "<ul><li><strong>Cache what you run every frame.</strong> Iterating a cached query is walking a list — nothing beats it. Systems do this by default. Don't cache what you create ad-hoc: cache construction costs more than a few uncached iterations.</li><li><strong>Let tables do the work.</strong> Everything that matches whole tables (plain components, tags, pairs, $this terms) is cheap per entity. Features that force per-entity work — sparse components, toggles, equality predicates, member matching, <code>each</code>-style variable fanout — are fine, but budget them.</li><li><strong>Rarest term first.</strong> Instructions run in term order, and each only sees survivors of the previous ones. Leading with <code>Position</code> (everyone has it) makes the engine trawl everything; leading with <code>Turret</code> narrows the field immediately.</li><li><strong>Use <code>ecs_each</code> for one-component sweeps</strong>, and <code>ecs_children</code> for child iteration — they skip query machinery entirely.</li><li><strong>Don't create queries in a loop.</strong> Even uncached creation parses, validates and compiles. Create once, reuse, or pre-bind variables on a shared query with <code>ecs_iter_set_var</code>.</li></ul>"
      },
      {
        type: "text",
        heading: "Wildcard costs",
        html: "<p>Wildcards multiply work in two ways. First, <code>(Likes, *)</code> yields one result <em>per matching pair per entity</em> — and multiple wildcard terms yield every permutation. If you only need &quot;has any Likes pair&quot;, the any-wildcard <code>(Likes, _)</code> returns at most one match per entity and stops searching early — much cheaper.</p><p>Second, direction matters. <code>(Likes, *)</code> with a known first element is a straight index lookup. But <code>(*, Cats)</code> must discover which relationships point at Cats — the VM runs dedicated id-enumeration instructions (<code>idsleft</code>/<code>idsright</code>) over the id index. Supported, but pricier; prefer pinning the first element when you can.</p>"
      },
      {
        type: "text",
        heading: "Fragmentation and empty tables",
        html: "<p>Every unique component combination is its own table. Thousands of small tables (heavy use of one-off pairs, for example) mean: more tables for uncached queries to test, more per-table overhead per iteration (batches shrink toward <code>count == 1</code>), bigger caches, and slower rematching. Uncached query search cost scales with the number of candidate tables; a bloom-filter bitmask per query (<code>ecs_query_t::bloom_filter</code>) discards obvious non-matches quickly, but can't repeal the arithmetic. If fragmentation is intrinsic to your data, consider sparse components, which trade iteration speed for zero fragmentation.</p><p>Tables that lose all entities linger, empty. Cached queries keep empty tables out of the iteration path by default, at the price of bookkeeping events; with <code>EcsQueryMatchEmptyTables</code> you opt out of that bookkeeping and instead call <code>ecs_delete_empty_tables</code> periodically — then be ready for results with <code>count == 0</code>.</p>"
      },
      {
        type: "text",
        heading: "Feature price list",
        html: "<ul><li><strong>Not / Optional</strong>: cheap — a per-table check, no extra searching.</li><li><strong>Traversal, uncached</strong>: walks the hierarchy per evaluation; caches help within one iteration, depth still costs.</li><li><strong>Traversal, cached</strong>: iteration is free, but watch <em>rematching</em> when parents and prefabs churn.</li><li><strong>Change detection</strong>: near-free to maintain; can eliminate whole tables of work. Keep read paths <code>[in]</code> so they don't self-trigger.</li><li><strong>Sorting</strong>: expensive when data changes often (re-sort plus slice rebuild); free-ish when stable.</li><li><strong>Grouping</strong>: cheapest ordering tool, constant-time maintenance; group iterators give per-bucket speed without per-bucket queries.</li></ul><p>When in doubt: print the plan with <code>ecs_query_plan</code>, profile with <code>ecs_query_plan_w_profile</code>, and watch the stats module in the Explorer — cache hits, rematches and evaluation counts are all tracked.</p>"
      }
    ],
    related: ["qry-cached", "qry-uncached", "qry-rematching", "qry-compiler", "storage", "observability"]
  }
]);
