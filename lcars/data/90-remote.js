window.FLECS_TOUR.register([
  {
    id: "net-json",
    parent: "remote",
    order: 1,
    title: "JSON Serialization",
    code: "NET-01",
    tagline: "Turn live data into text, and text back into data",
    intro: "The JSON addon converts things living inside your world into JSON text — and back. It can serialize a single component value, a whole entity, the results of a query, or the entire world. It works by reading the <em>reflection</em> data from the meta addon: once Flecs knows your struct has a float x and a float y, it can write it out as <code>{\"x\": 10, \"y\": 20}</code> without you writing any conversion code.",
    sections: [
      {
        type: "text",
        heading: "Four sizes of snapshot",
        html: "<p>Think of it like photographing your world at four zoom levels:</p><ul><li><strong>A value</strong> — <code>ecs_ptr_to_json</code> turns one component value into JSON, like photographing a single object on a desk. <code>ecs_array_to_json</code> does the same for a row of values.</li><li><strong>An entity</strong> — <code>ecs_entity_to_json</code> captures one entity with its name, tags, pairs and component values.</li><li><strong>A query result</strong> — <code>ecs_iter_to_json</code> takes any iterator and writes out every matched entity with the fields the query asked for.</li><li><strong>The world</strong> — <code>ecs_world_to_json</code> captures everything, which is how you save and load a whole scene.</li></ul><p>Each of these also has a <code>_buf</code> variant (like <code>ecs_ptr_to_json_buf</code>) that appends to a string builder (<code>ecs_strbuf_t</code>) instead of allocating a fresh string, which is what the REST API uses to build replies. Strings returned by the plain variants are yours to free with <code>ecs_os_free</code>.</p>"
      },
      {
        type: "diagram",
        heading: "Everything flows through reflection",
        spec: {
          type: "flow",
          lanes: [
            [
              { id: "j1", label: "A value", sub: "ecs_ptr_to_json" },
              { id: "j2", label: "An entity", sub: "ecs_entity_to_json" },
              { id: "j3", label: "A query result", sub: "ecs_iter_to_json" },
              { id: "j4", label: "The world", sub: "ecs_world_to_json" }
            ],
            [ { id: "meta", label: "Meta walk", sub: "reads your type's reflection data" } ],
            [ { id: "out", label: "JSON string", sub: "or ecs_strbuf_t buffer" } ]
          ],
          edges: [
            { from: "j1", to: "meta" },
            { from: "j2", to: "meta" },
            { from: "j3", to: "meta" },
            { from: "j4", to: "meta" },
            { from: "meta", to: "out" }
          ],
          note: "Components without reflection data still show up, but their value is written as null."
        }
      },
      {
        type: "code",
        heading: "The smallest example",
        lang: "c",
        title: "Serialize one value",
        src: "typedef struct { float x, y; } Position;\n\nECS_COMPONENT(world, Position);\necs_struct(world, {\n  .entity = ecs_id(Position),\n  .members = {\n    { .name = \"x\", .type = ecs_id(ecs_f32_t) },\n    { .name = \"y\", .type = ecs_id(ecs_f32_t) }\n  }\n});\n\nPosition p = {10, 20};\nchar *json = ecs_ptr_to_json(world, ecs_id(Position), &p);\nprintf(\"%s\\n\", json);\necs_os_free(json);"
      },
      {
        type: "text",
        heading: "What you need",
        html: "<p>Compile with the <code>FLECS_JSON</code> addon. It automatically pulls in <code>FLECS_META</code> (reflection) and <code>FLECS_DOC</code>, because it cannot serialize a struct it doesn't have a description of, and it can optionally include doc attributes like display names and colors.</p><p>There is also <code>ecs_type_info_to_json</code>, which doesn't serialize a value at all — it serializes the <em>shape</em> of a type (its members and their types), so a remote tool can build an editor UI for a component it has never seen.</p>"
      }
    ],
    related: ["reflection", "net-rest", "net-json-world"]
  },
  {
    id: "net-json-entity",
    parent: "net-json",
    order: 1,
    title: "Serializing Entities",
    code: "NET-01A",
    tagline: "One entity, everything it has, as one JSON object",
    intro: "<code>ecs_entity_to_json</code> writes a complete portrait of one entity: where it lives in the hierarchy (<code>parent</code>), what it's called (<code>name</code>), its tags, its relationship pairs, and its component values. A struct full of on/off switches — <code>ecs_entity_to_json_desc_t</code> — controls exactly how much detail goes into the picture.",
    sections: [
      {
        type: "code",
        heading: "Serializing an entity",
        lang: "c",
        src: "ecs_entity_t e = ecs_lookup(world, \"Sun.Earth\");\n\necs_entity_to_json_desc_t desc = ECS_ENTITY_TO_JSON_INIT;\ndesc.serialize_entity_id = true;\ndesc.serialize_type_info = true;\nchar *json = ecs_entity_to_json(world, e, &desc);\necs_os_free(json);"
      },
      {
        type: "code",
        heading: "What comes out",
        lang: "json",
        title: "GET portrait of Sun.Earth",
        src: "{\n  \"parent\": \"Sun\",\n  \"name\": \"Earth\",\n  \"tags\": [\n    \"Planet\"\n  ],\n  \"pairs\": {\n    \"flecs.core.IsA\": \"HabitablePlanet\"\n  },\n  \"components\": {\n    \"Mass\": {\n      \"value\": \"5.9722e24\"\n    },\n    \"Position\": null\n  }\n}"
      },
      {
        type: "text",
        heading: "Reading the output",
        html: "<p>A few things to notice:</p><ul><li>Tags (no data) go in the <code>tags</code> array, relationship pairs in the <code>pairs</code> object, and components with data in the <code>components</code> object.</li><li><code>Position</code> is <code>null</code> here because it has no reflection data — Flecs knows the entity has it, but not what's inside.</li><li>Passing <code>NULL</code> for the desc gives you the defaults: full paths and component values on, everything else off. <code>ECS_ENTITY_TO_JSON_INIT</code> gives you the same defaults as a starting point to tweak.</li></ul>"
      },
      {
        type: "struct",
        heading: "The control panel",
        name: "ecs_entity_to_json_desc_t",
        summary: "Every switch that controls what goes into the entity's JSON portrait.",
        members: [
          { name: "serialize_entity_id", type: "bool", desc: "Include the entity's numeric id as an \"id\" member, next to its name." },
          { name: "serialize_doc", type: "bool", desc: "Include doc attributes: the human-friendly display name, description and color from the doc addon." },
          { name: "serialize_full_paths", type: "bool", desc: "Write tags, components and pairs with their full path (\"flecs.core.IsA\") instead of just the short name. On by default so names are unambiguous." },
          { name: "serialize_inherited", type: "bool", desc: "Also include tags and components the entity inherits from its IsA prefabs, grouped per prefab in an \"inherited\" object." },
          { name: "serialize_values", type: "bool", desc: "Include the actual component values. Turn off to get just the list of what the entity has, which is cheaper. On by default." },
          { name: "serialize_builtin", type: "bool", desc: "Write built-in data like the name and parent as regular components instead of the special top-level members." },
          { name: "serialize_type_info", type: "bool", desc: "Add a \"type_info\" object describing the schema of each component, so a remote tool can build an editor for it. Requires serialize_values." },
          { name: "serialize_alerts", type: "bool", desc: "Include any active alerts (from the alerts addon) raised on this entity." },
          { name: "serialize_refs", type: "ecs_entity_t", desc: "Include incoming relationships: pass a relationship (or EcsWildcard) and the output lists which entities point at this one through it." },
          { name: "serialize_matches", type: "bool", desc: "List the named queries this entity is matched by." },
          { name: "component_filter", type: "bool (*)(...)", desc: "Your own callback that gets to say yes or no for each component, if you want to leave some out." }
        ]
      }
    ],
    related: ["net-json-from", "net-rest-endpoints", "lifecycle"]
  },
  {
    id: "net-json-iter",
    parent: "net-json",
    order: 2,
    title: "Serializing Query Results",
    code: "NET-01B",
    tagline: "A whole query answer as one JSON document",
    intro: "<code>ecs_iter_to_json</code> takes any iterator — from a query, a system, or even <code>ecs_each</code> — walks it to the end, and writes every matched entity into one JSON document. This is the workhorse behind the REST API's query endpoint: what the Flecs Explorer shows you when you type a query is exactly this output.",
    sections: [
      {
        type: "text",
        heading: "The shape of a result",
        html: "<p>The output is an object with a <code>results</code> array. Each result is one matched entity, with its <code>parent</code> and <code>name</code>, and a <code>fields</code> object holding the data the query asked for. The <code>values</code> array inside <code>fields</code> lines up with the query's terms: first value is the first term, second value is the second term, and so on — the same order you'd use with <code>ecs_field</code> in C.</p><p>Extra members appear only when they carry information:</p><ul><li><code>is_set</code> — added when an optional field wasn't matched.</li><li><code>sources</code> — added when a field came from another entity (for example a parent, matched with <code>up</code>). A <code>0</code> means \"from the entity itself\".</li><li><code>ids</code> — added when a term's component id varies per result, like a pair with a variable.</li><li><code>vars</code> — the values of query variables like <code>$p</code>, per result.</li></ul>"
      },
      {
        type: "code",
        heading: "Serializing a query",
        lang: "c",
        src: "ecs_query_t *q = ecs_query(world, {\n  .expr = \"Position, Velocity\"\n});\n\necs_iter_t it = ecs_query_iter(world, q);\nchar *json = ecs_iter_to_json(&it, NULL);\necs_os_free(json);"
      },
      {
        type: "code",
        heading: "What comes out",
        lang: "json",
        title: "Results for \"Position, Velocity\"",
        src: "{\n  \"results\": [\n    {\n      \"parent\": \"Earth.shipyard\",\n      \"name\": \"USS Enterprise\",\n      \"fields\": {\n        \"values\": [\n          { \"x\": 10, \"y\": 20 },\n          { \"x\": 1, \"y\": 2 }\n        ]\n      }\n    },\n    {\n      \"parent\": \"Earth.shipyard\",\n      \"name\": \"USS Voyager\",\n      \"fields\": {\n        \"values\": [\n          { \"x\": 30, \"y\": 40 },\n          { \"x\": 3, \"y\": 4 }\n        ]\n      }\n    }\n  ]\n}"
      },
      {
        type: "struct",
        heading: "The control panel",
        name: "ecs_iter_to_json_desc_t",
        summary: "Switches for what each result includes, plus a few that add query metadata to the document.",
        members: [
          { name: "serialize_entity_ids", type: "bool", desc: "Include each matched entity's numeric id as an \"id\" member." },
          { name: "serialize_values", type: "bool", desc: "Include component values in the fields. On by default." },
          { name: "serialize_builtin", type: "bool", desc: "Write built-in data like name and parent as regular components instead of special members." },
          { name: "serialize_doc", type: "bool", desc: "Include doc attributes (display name, color) for entities and components." },
          { name: "serialize_full_paths", type: "bool", desc: "Use full paths for tags, components and pairs. On by default." },
          { name: "serialize_fields", type: "bool", desc: "Include the \"fields\" object with per-term data. On by default; turn off if you only need the list of matched entities." },
          { name: "serialize_inherited", type: "bool", desc: "Include components inherited from prefabs." },
          { name: "serialize_table", type: "bool", desc: "Instead of just the queried fields, serialize each entity's entire table — everything it has, in the same format as the entity serializer." },
          { name: "serialize_type_info", type: "bool", desc: "Add schema descriptions for the serialized component types." },
          { name: "serialize_field_info", type: "bool", desc: "Add a \"field_info\" array with one entry per query field: its id, type and schema." },
          { name: "serialize_query_info", type: "bool", desc: "Add a \"query_info\" object describing the query itself, term by term." },
          { name: "serialize_query_plan", type: "bool", desc: "Include the compiled query plan, the instructions the query VM runs. Needs the query member set." },
          { name: "serialize_query_profile", type: "bool", desc: "Measure and include how long evaluating the query took. Needs the query member set." },
          { name: "dont_serialize_results", type: "bool", desc: "Skip evaluating the query entirely — useful when you only want the metadata, like field_info or query_info." },
          { name: "serialize_alerts", type: "bool", desc: "Include active alerts for matched entities." },
          { name: "serialize_refs", type: "ecs_entity_t", desc: "Include incoming relationships for matched entities, for the given relationship." },
          { name: "serialize_matches", type: "bool", desc: "List the named queries each matched entity is matched by." },
          { name: "serialize_parents_before_children", type: "bool", desc: "If both a parent and its children match, put the parent earlier in the results — handy when replaying the document to rebuild a hierarchy." },
          { name: "component_filter", type: "bool (*)(...)", desc: "Your own callback deciding per component whether it gets serialized." },
          { name: "query", type: "ecs_poly_t *", desc: "The query object itself; required for serialize_query_plan and serialize_query_profile." }
        ]
      }
    ],
    related: ["queries", "net-rest-query"]
  },
  {
    id: "net-json-world",
    parent: "net-json",
    order: 3,
    title: "World Snapshots",
    code: "NET-01C",
    tagline: "Save your whole scene to a string, load it back later",
    intro: "<code>ecs_world_to_json</code> photographs the entire world into one JSON document, and <code>ecs_world_from_json</code> rebuilds a world from that photograph. Together they give you save files, scene export, and copying a live world into a test — all without writing serialization code per component.",
    sections: [
      {
        type: "code",
        heading: "Save and restore",
        lang: "c",
        src: "char *json = ecs_world_to_json(world, NULL);\n\necs_world_t *world2 = ecs_init();\necs_world_from_json(world2, json, NULL);\necs_os_free(json);\n\necs_world_from_json_file(world, \"savegame.json\", NULL);"
      },
      {
        type: "text",
        heading: "What's in the photograph",
        html: "<p>Under the hood, <code>ecs_world_to_json</code> is just the iterator serializer pointed at a query that matches everything, with <code>serialize_table</code> turned on — so every entity appears with its full contents. But \"everything\" is filtered sensibly by default:</p><ul><li><strong>Excluded:</strong> Flecs built-in entities and modules (everything under the <code>flecs</code> scope), and the contents of your own modules — the machinery, not the scene.</li><li><strong>Included:</strong> your scene entities, including prefabs and disabled entities.</li></ul><p>Two switches widen the shot: <code>serialize_builtin</code> pulls in the Flecs built-ins, and <code>serialize_modules</code> pulls in module contents. You almost never want these for save files — component ids and other built-ins are recreated when a world starts up, so saving them mostly adds noise.</p>"
      },
      {
        type: "struct",
        heading: "The control panel",
        name: "ecs_world_to_json_desc_t",
        summary: "Only two switches: how much of the machinery to include in the snapshot.",
        members: [
          { name: "serialize_builtin", type: "bool", desc: "Also serialize Flecs built-in modules and their contents. Off by default." },
          { name: "serialize_modules", type: "bool", desc: "Also serialize your application's modules and their contents. Off by default." }
        ]
      },
      {
        type: "diagram",
        heading: "The round trip",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "w1", label: "Live world", sub: "entities, components" } ],
            [ { id: "js", label: "JSON document", sub: "ecs_world_to_json" } ],
            [ { id: "st", label: "File / database / network", sub: "plain text, goes anywhere" } ],
            [ { id: "w2", label: "World again", sub: "ecs_world_from_json" } ]
          ],
          edges: [
            { from: "w1", to: "js" },
            { from: "js", to: "st" },
            { from: "st", to: "w2" }
          ],
          note: "Restoring matches entities by path, so loading into a non-empty world updates existing entities instead of duplicating them."
        }
      }
    ],
    related: ["net-json-from", "net-json-iter", "script"]
  },
  {
    id: "net-json-from",
    parent: "net-json",
    order: 4,
    title: "Deserializing",
    code: "NET-01D",
    tagline: "Reading JSON back into live component memory",
    intro: "Going from JSON back to data is the mirror image of serializing, and it comes in the same three sizes: <code>ecs_ptr_from_json</code> fills in one component value, <code>ecs_entity_from_json</code> rebuilds one entity, and <code>ecs_world_from_json</code> rebuilds many. All of them lean on the meta addon's <em>cursor</em>: a little machine that walks through a type member by member and writes values into the right bytes.",
    sections: [
      {
        type: "text",
        heading: "How the cursor does the work",
        html: "<p>Imagine filling in a paper form where someone reads values out loud to you: \"x is 10... y is 20\". The reader is the JSON parser; you, moving your pen to the right box each time, are the <strong>meta cursor</strong>. The deserializer opens a cursor on the target type, and for every JSON member it tells the cursor \"move to the member with this name, write this number\". Because the cursor knows the type's layout from reflection data, the value lands at exactly the right offset in memory.</p><p>This is why deserialization needs reflection data: without it, the cursor doesn't know where the boxes are. By default, values for components without reflection data are silently skipped; set <code>strict</code> in the desc to make that an error instead.</p>"
      },
      {
        type: "code",
        heading: "The three deserializers",
        lang: "c",
        src: "Position p;\necs_ptr_from_json(world, ecs_id(Position), &p,\n  \"{\\\"x\\\": 10, \\\"y\\\": 20}\", NULL);\n\necs_entity_t e = ecs_entity(world, { .name = \"Earth\" });\necs_entity_from_json(world, e,\n  \"{\\\"tags\\\": [\\\"Planet\\\"], \"\n  \"\\\"components\\\": {\\\"Position\\\": {\\\"x\\\": 1, \\\"y\\\": 2}}}\",\n  NULL);\n\necs_world_from_json(world, world_json, NULL);"
      },
      {
        type: "text",
        heading: "What each one accepts",
        html: "<p><code>ecs_entity_from_json</code> reads the same format <code>ecs_entity_to_json</code> writes: the <code>parent</code>, <code>name</code>, <code>tags</code>, <code>pairs</code> and <code>components</code> members. Tags and components that don't exist yet are added to the entity; values are written through the cursor. <code>ecs_world_from_json</code> does this for every result in a world document, creating entities by path as needed, and <code>ecs_world_from_json_file</code> reads the document from disk first.</p><p>All three return a pointer to the character just past what they parsed, or <code>NULL</code> on failure — so you can check success and also parse JSON that's embedded in a larger text.</p>"
      },
      {
        type: "struct",
        heading: "The control panel",
        name: "ecs_from_json_desc_t",
        summary: "Options shared by all the from_json functions.",
        members: [
          { name: "name", type: "const char *", desc: "A name for the input (like a filename), used to make error messages point somewhere useful." },
          { name: "expr", type: "const char *", desc: "The full source text, used by error messages to show where in the input the problem is." },
          { name: "lookup_action", type: "ecs_entity_t (*)(...)", desc: "Your own function for turning names in the JSON into entities, replacing the default ecs_lookup. Useful for remapping names when importing." },
          { name: "lookup_ctx", type: "void *", desc: "A pointer handed to your lookup_action so it can carry state." },
          { name: "strict", type: "bool", desc: "Fail when a component has no reflection data, instead of silently skipping its value." }
        ]
      }
    ],
    related: ["reflection", "net-json-entity", "net-json-world"]
  },
  {
    id: "net-http",
    parent: "remote",
    order: 2,
    title: "The HTTP Server",
    code: "NET-02",
    tagline: "A one-room web server living inside your game",
    intro: "The HTTP addon is a tiny web server you can embed in your application, just big enough to serve the REST API. Its design solves one tricky problem: web requests arrive whenever they like, but the ECS world can only safely be read between frames. So the server <em>catches</em> requests on its own thread, holds them in a queue, and lets your main loop answer them at a safe moment.",
    sections: [
      {
        type: "diagram",
        heading: "Life of a request",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "cl", label: "Browser / tool", sub: "sends HTTP request" } ],
            [ { id: "rt", label: "Receive thread", sub: "parses, enqueues" },
              { id: "rq", label: "Request queue", sub: "waits for the frame" } ],
            [ { id: "mt", label: "Your frame", sub: "ecs_http_server_dequeue" },
              { id: "cb", label: "Callback", sub: "builds the reply" } ],
            [ { id: "sq", label: "Send thread", sub: "flushes replies" } ]
          ],
          edges: [
            { from: "cl", to: "rt" },
            { from: "rt", to: "rq" },
            { from: "rq", to: "mt" },
            { from: "mt", to: "cb" },
            { from: "cb", to: "sq" },
            { from: "sq", to: "cl", label: "response" }
          ],
          note: "Requests are answered a little later than a normal web server would, but the world never needs a lock."
        }
      },
      {
        type: "text",
        heading: "The pieces",
        html: "<p>When you start a server, it spins up two threads:</p><ul><li>A <strong>receive thread</strong> that accepts connections, parses requests, and drops them into a queue. It never touches the world.</li><li>A <strong>send thread</strong> that flushes finished replies back to clients, so a slow connection can't hold up your frame.</li></ul><p>In between sits your code: calling <code>ecs_http_server_dequeue</code> pops the queued requests and invokes your callback for each one. The callback receives an <code>ecs_http_request_t</code> (method, path, headers, URL parameters, body) and fills in an <code>ecs_http_reply_t</code> (status code, body, content type). Return <code>false</code> and the server answers 404 for you. When the REST addon is active, a system named <code>DequeueRest</code> calls dequeue for you at the end of every frame.</p><p>The server can also cache GET responses: with <code>cache_timeout</code> set, a repeated identical request within that window gets the stored answer without invoking your callback again. The REST addon uses a 0.2 second cache, which keeps the Explorer's rapid polling cheap.</p>"
      },
      {
        type: "code",
        heading: "A minimal server",
        lang: "c",
        src: "bool my_reply(const ecs_http_request_t *req,\n  ecs_http_reply_t *reply, void *ctx)\n{\n  if (req->method == EcsHttpGet) {\n    ecs_strbuf_appendlit(&reply->body, \"{\\\"hello\\\": \\\"world\\\"}\");\n    return true;\n  }\n  return false;\n}\n\necs_http_server_t *srv = ecs_http_server_init(\n  &(ecs_http_server_desc_t){\n    .callback = my_reply,\n    .port = 8080\n  });\n\necs_http_server_start(srv);\n\nwhile (running) {\n  ecs_http_server_dequeue(srv, delta_time);\n}\n\necs_http_server_fini(srv);"
      },
      {
        type: "struct",
        heading: "The control panel",
        name: "ecs_http_server_desc_t",
        summary: "Everything you can configure when creating a server with ecs_http_server_init.",
        members: [
          { name: "callback", type: "ecs_http_reply_action_t", desc: "The function called for each request when you dequeue. It fills in the reply and returns true, or returns false to send a 404." },
          { name: "ctx", type: "void *", desc: "A pointer of your choosing, handed to the callback on every request." },
          { name: "port", type: "uint16_t", desc: "The port to listen on. The REST addon defaults this to 27750." },
          { name: "ipaddr", type: "const char *", desc: "Which network interface to listen on. Leave empty to listen on all of them (0.0.0.0)." },
          { name: "send_queue_wait_ms", type: "int32_t", desc: "How long the send thread naps when it has nothing to send. Defaults to 1 millisecond." },
          { name: "cache_timeout", type: "double", desc: "How long (in seconds) a GET response may be reused for identical requests. Zero disables caching." },
          { name: "cache_purge_timeout", type: "double", desc: "How long stale cache entries linger before being thrown away. Defaults to ten times cache_timeout." }
        ]
      },
      {
        type: "text",
        heading: "Requests without sockets",
        html: "<p><code>ecs_http_server_request(srv, \"GET\", \"/entity/Earth\", NULL, &reply)</code> pushes a request through the server <em>directly</em>, no network involved. This is how you bolt the REST API onto a production-grade third-party web server (it handles the sockets, you forward requests), and how the Explorer talks to Flecs apps compiled to WebAssembly, where there are no sockets at all.</p><p>One honest warning from the header itself: this server is meant for development. For anything facing the internet, put a real web server in front and forward requests.</p>"
      }
    ],
    related: ["net-rest", "net-rest-enable", "internals"]
  },
  {
    id: "net-rest",
    parent: "remote",
    order: 3,
    title: "The REST API",
    code: "NET-03",
    tagline: "Every corner of your world, reachable by URL",
    intro: "The REST addon glues the HTTP server and the JSON serializer together: it registers a callback that turns URLs like <code>/entity/Sun/Earth</code> into serializer calls and sends the JSON back. Anything that can make an HTTP request — a browser, curl, a Python script, the Flecs Explorer — can now read and even modify your live world.",
    sections: [
      {
        type: "diagram",
        heading: "How the layers stack",
        spec: {
          type: "stack",
          layers: [
            { label: "Client", sub: "Explorer, curl, your web app" },
            { label: "REST API", sub: "routes URLs to handlers" },
            { label: "HTTP server + JSON serializer", sub: "transport and translation" },
            { label: "The world", sub: "entities, components, queries, stats" }
          ],
          note: "Each REST endpoint is a thin wrapper over a JSON serializer function you could call yourself."
        }
      },
      {
        type: "text",
        heading: "One naming rule to remember",
        html: "<p>Endpoint options map one-to-one to the JSON serializer options, minus the <code>serialize_</code> prefix. Asking for <code>/entity/Earth?values=false</code> is exactly calling <code>ecs_entity_to_json</code> with <code>serialize_values = false</code>. Learn the desc structs and you've learned the URL options for free.</p>"
      },
      {
        type: "text",
        heading: "The endpoint map",
        html: "<p>The API groups into four families, covered by the pages below:</p><ul><li><strong>Entities and components</strong> — <code>/entity</code>, <code>/component</code> and <code>/toggle</code>: read, create, modify and delete individual entities and their components.</li><li><strong>Queries</strong> — <code>/query</code>: run any query expression and get the matches as JSON.</li><li><strong>World and tooling</strong> — <code>/world</code>, <code>/type_info</code>, <code>/components</code>, <code>/queries</code>, <code>/tables</code>, <code>/stats/*</code>, <code>/commands/*</code>, <code>/action</code>, <code>/call</code> and <code>/script</code>: snapshots, schemas, performance numbers and remote script editing.</li><li><strong>Turning it on</strong> — one singleton, one line of code.</li></ul>"
      }
    ],
    related: ["net-http", "net-json", "net-explorer"]
  },
  {
    id: "net-rest-enable",
    parent: "net-rest",
    order: 1,
    title: "Turning It On",
    code: "NET-03A",
    tagline: "One singleton and your world is on the air",
    intro: "You enable the REST API by setting one component: the <code>EcsRest</code> singleton. Setting it creates and starts the HTTP server; a built-in system then answers queued requests at the end of every frame, as part of your normal <code>ecs_progress</code> loop.",
    sections: [
      {
        type: "code",
        heading: "The two ways to enable it",
        lang: "c",
        src: "ECS_IMPORT(world, FlecsStats);\necs_singleton_set(world, EcsRest, {0});\nwhile (ecs_progress(world, 0)) { }\n\necs_app_run(world, &(ecs_app_desc_t){\n  .enable_stats = true,\n  .enable_rest = true\n});"
      },
      {
        type: "text",
        heading: "What setting the singleton actually does",
        html: "<p>The <code>EcsRest</code> component has an <code>on_set</code> hook — a function that runs the moment the value is written. The hook fills in the default port (27750) if you passed 0, creates a REST-flavored HTTP server with a 0.2 second response cache, and starts it. Importing the stats module first is optional but recommended: it's what feeds the Explorer's performance graphs.</p><p>From then on, a system called <code>DequeueRest</code> runs in the <code>EcsPostFrame</code> phase — the very end of each frame — and dequeues pending requests. It runs with direct world access (no deferring), so handlers can create and delete entities on the spot. If your frames take longer than a second, Flecs logs a warning, because a browser waiting on the queue may time out.</p><p>Two more details worth knowing:</p><ul><li>Disabling the <code>FlecsRest</code> module (adding <code>Disabled</code> to it) stops the server; re-enabling starts it again.</li><li>By default the server listens on all interfaces (0.0.0.0). Set <code>ipaddr</code> to <code>\"127.0.0.1\"</code> if you only want your own machine to reach it.</li></ul>"
      },
      {
        type: "struct",
        heading: "The singleton",
        name: "EcsRest",
        summary: "The component you set to spin up the REST server.",
        members: [
          { name: "port", type: "uint16_t", desc: "The port to serve on. Leave 0 for the default, 27750, which is where the Explorer looks." },
          { name: "ipaddr", type: "char *", desc: "The interface to listen on. Leave empty for all interfaces (0.0.0.0)." },
          { name: "impl", type: "ecs_rest_ctx_t *", desc: "Private bookkeeping filled in by Flecs: the server handle and its state. Not yours to touch." }
        ]
      },
      {
        type: "code",
        heading: "Without the systems addon",
        lang: "c",
        title: "Manual control, or no sockets at all",
        src: "ecs_http_server_t *srv = ecs_rest_server_init(world, NULL);\n\necs_http_reply_t reply = ECS_HTTP_REPLY_INIT;\nint res = ecs_http_server_request(srv,\n  \"GET\", \"/entity/my_entity\", NULL, &reply);\nif (res || reply.code != 200) {\n}\n\nchar *body = ecs_strbuf_get(&reply.body);\necs_os_free(body);\n\necs_rest_server_fini(srv);"
      }
    ],
    related: ["net-http", "systems", "net-explorer"]
  },
  {
    id: "net-rest-endpoints",
    parent: "net-rest",
    order: 2,
    title: "Entity & Component Endpoints",
    code: "NET-03B",
    tagline: "Read, create, edit and delete things by URL",
    intro: "These endpoints treat your world like a filing cabinet you can reach over the network. The entity's path becomes the URL path — entity <code>Sun.Earth</code> lives at <code>/entity/Sun/Earth</code> — and the HTTP method says what to do: GET reads, PUT creates or writes, DELETE removes.",
    sections: [
      {
        type: "text",
        heading: "The verbs",
        html: "<p><strong>Whole entities:</strong></p><ul><li><code>GET /entity/&lt;path&gt;</code> — the entity's full JSON portrait, with the same URL options as the entity serializer's switches: <code>values</code>, <code>inherited</code>, <code>type_info</code>, <code>entity_id</code>, <code>doc</code>, <code>full_paths</code>, <code>builtin</code>, <code>alerts</code>, <code>refs</code>, <code>matches</code>.</li><li><code>PUT /entity/&lt;path&gt;</code> — create an entity at that path.</li><li><code>DELETE /entity/&lt;path&gt;</code> — delete it.</li></ul><p><strong>Single components:</strong></p><ul><li><code>GET /component/&lt;path&gt;?component=&lt;c&gt;</code> — just one component's value.</li><li><code>PUT /component/&lt;path&gt;?component=&lt;c&gt;&amp;value=&lt;json&gt;</code> — add the component, and set its value if you pass one (URL-encoded JSON).</li><li><code>DELETE /component/&lt;path&gt;?component=&lt;c&gt;</code> — remove it.</li></ul><p><strong>Switches:</strong></p><ul><li><code>PUT /toggle/&lt;path&gt;?enable=false</code> — disable an entity (adds the <code>Disabled</code> tag); add <code>&amp;component=&lt;c&gt;</code> to toggle one component instead, which requires that component to have the <code>CanToggle</code> trait.</li></ul>"
      },
      {
        type: "code",
        heading: "From your terminal",
        lang: "bash",
        src: "curl 'localhost:27750/entity/Sun/Earth?type_info=true'\n\ncurl -X PUT 'localhost:27750/entity/Sun/Moon'\n\ncurl -X PUT 'localhost:27750/component/Sun/Moon?component=Position&value=%7B%22x%22%3A10%7D'\n\ncurl -X DELETE 'localhost:27750/component/Sun/Moon?component=Position'"
      },
      {
        type: "code",
        heading: "A component reply",
        lang: "json",
        title: "GET /component/Sun/Earth?component=planets.Mass",
        src: "{ \"value\": \"5.9722e24\" }"
      },
      {
        type: "text",
        heading: "What this means",
        html: "<p>Every one of these maps to a plain API call you already know: <code>ecs_entity_to_json</code>, <code>ecs_entity</code> with a name, <code>ecs_delete</code>, <code>ecs_ptr_to_json</code>, <code>ecs_ptr_from_json</code>, <code>ecs_remove_id</code>, <code>ecs_enable</code>. The REST layer adds nothing magical — which is exactly why it's trustworthy: whatever a remote tool does, you could have done in code.</p>"
      }
    ],
    related: ["net-json-entity", "net-json-from", "components"]
  },
  {
    id: "net-rest-query",
    parent: "net-rest",
    order: 3,
    title: "The Query Endpoint",
    code: "NET-03C",
    tagline: "Type a query in a URL, get the matches back",
    intro: "<code>GET /query?expr=...</code> runs any query expression against the live world and returns the results as JSON — the same document <code>ecs_iter_to_json</code> produces. This one endpoint is most of what the Flecs Explorer's query tab is.",
    sections: [
      {
        type: "code",
        heading: "Asking a question over HTTP",
        lang: "bash",
        title: "The expression is URL-encoded: comma is %2C",
        src: "curl 'localhost:27750/query?expr=Position%2CVelocity'\n\ncurl 'localhost:27750/query?name=systems.Move'\n\ncurl 'localhost:27750/query?expr=Position&limit=10&offset=20'"
      },
      {
        type: "code",
        heading: "The reply",
        lang: "json",
        src: "{\n  \"results\": [\n    {\n      \"parent\": \"Earth.shipyard\",\n      \"name\": \"USS Enterprise\",\n      \"fields\": {\n        \"values\": [\n          { \"x\": 10, \"y\": 20 },\n          { \"x\": 1, \"y\": 2 }\n        ]\n      }\n    }\n  ]\n}"
      },
      {
        type: "text",
        heading: "The options",
        html: "<p>A few options are specific to this endpoint:</p><ul><li><code>expr</code> — a query expression to parse and run, or <code>name</code> — the path of an existing named query (like a system's query) to run instead.</li><li><code>vars</code> — bind values to query variables of a named query before running it.</li><li><code>offset</code> and <code>limit</code> — pagination; limit defaults to 1000 so a huge world can't accidentally flood the connection.</li><li><code>try</code> — return errors in the JSON body instead of an HTTP error status, so a UI can show \"query didn't parse\" gracefully.</li></ul><p>Everything else mirrors the iterator serializer's switches: <code>values</code>, <code>fields</code>, <code>table</code>, <code>entity_ids</code>, <code>inherited</code>, <code>type_info</code>, <code>field_info</code>, <code>query_info</code>, <code>query_plan</code>, <code>query_profile</code>, and <code>results=false</code> for a metadata-only request. Asking for <code>query_plan</code> here is a lovely trick: you can inspect how the query VM will execute a query without adding a line of code to your app.</p>"
      }
    ],
    related: ["net-json-iter", "queries", "net-explorer"]
  },
  {
    id: "net-rest-tools",
    parent: "net-rest",
    order: 4,
    title: "World, Stats & Tooling Endpoints",
    code: "NET-03D",
    tagline: "Snapshots, schemas, performance numbers and remote script editing",
    intro: "Beyond entities and queries, the REST API exposes the world's self-knowledge: full snapshots, component schemas, lists of queries and tables, performance statistics, a recorder for deferred commands, and even the ability to update Flecs scripts in a running app. These endpoints are what turn the Explorer from a viewer into a dashboard and editor.",
    sections: [
      {
        type: "text",
        heading: "Introspection endpoints",
        html: "<ul><li><code>GET /world</code> — the whole scene as JSON, same as <code>ecs_world_to_json</code>: modules and built-ins excluded, prefabs and disabled entities included.</li><li><code>GET /type_info/&lt;path&gt;</code> — the reflection schema for one component, from <code>ecs_type_info_to_json</code>. Answers 404 if the entity doesn't exist and 204 if it has no reflection data.</li><li><code>GET /components</code> — every component with its reflection metadata and which lifecycle hooks it has registered.</li><li><code>GET /queries</code> — all named queries in the world.</li><li><code>GET /tables</code> — every table and its makeup, a live X-ray of the storage engine.</li></ul>"
      },
      {
        type: "code",
        heading: "A schema reply",
        lang: "json",
        title: "type_info for a Mass component with a unit",
        src: "{\n  \"value\": [\n    \"float\",\n    {\n      \"unit\": \"flecs.units.Mass.KiloGrams\",\n      \"symbol\": \"kg\",\n      \"quantity\": \"flecs.units.Mass\"\n    }\n  ]\n}"
      },
      {
        type: "text",
        heading: "Statistics and command capture",
        html: "<p>With the <code>FlecsStats</code> module imported, two endpoints serve the numbers behind the Explorer's graphs:</p><ul><li><code>GET /stats/world?period=1s</code> — world-level counters: entity counts, frame time, memory. Periods are <code>1s</code>, <code>1m</code>, <code>1h</code>, <code>1d</code>, <code>1w</code>.</li><li><code>GET /stats/pipeline?period=1s&amp;name=all</code> — per-system timing for a pipeline, so you can see which system eats your frame.</li></ul><p>The command capture pair is a flight recorder for structural changes: <code>GET /commands/capture</code> starts recording each frame's deferred commands (kept for roughly a minute), and <code>GET /commands/frame/&lt;n&gt;</code> plays back what was enqueued in frame n — invaluable when you're chasing where a mystery add or delete came from.</p>"
      },
      {
        type: "text",
        heading: "Acting on the world",
        html: "<ul><li><code>PUT /action/shrink_memory</code> — runs <code>ecs_shrink</code> to hand unused memory back.</li><li><code>GET /call/&lt;path&gt;?arg=value</code> — call a Flecs script function by name, parameters matched by name, return value serialized as JSON. Requires the script addon.</li><li><code>PUT /script/&lt;path&gt;?code=...</code> — replace the code of a managed script; the body is used if the <code>code</code> parameter is omitted. Options let you compare against (<code>check_file</code>) or save to (<code>save_file</code>) the file on disk. A parse failure returns the error with line and column, which is how the Explorer's script editor shows you squiggles.</li></ul>"
      }
    ],
    related: ["observability", "script", "storage"]
  },
  {
    id: "net-explorer",
    parent: "remote",
    order: 4,
    title: "The Flecs Explorer",
    code: "NET-04",
    tagline: "A cockpit for your world, running in a browser tab",
    intro: "The Flecs Explorer is a web application at <code>flecs.dev/explorer</code> that connects to your running game over the REST API. It shows the entity tree, lets you inspect and edit component values, run queries, watch performance graphs, and edit scripts — all live, while your game keeps running. It's the payoff for everything else in this deck.",
    sections: [
      {
        type: "text",
        heading: "Sixty seconds to takeoff",
        html: "<p>Add the REST singleton (and, ideally, the stats module) to your app, run it, then open <code>https://flecs.dev/explorer</code> in a browser on the same machine. The page immediately tries <code>localhost:27750</code> — the REST default port — and if your app is listening there, it connects on its own. No plugin, no install, no build step.</p><p>Once connected you can:</p><ul><li><strong>Browse</strong> the entity tree, exactly mirroring your parent-child hierarchy.</li><li><strong>Inspect and edit</strong> — click an entity to see its tags, pairs and components; components with reflection data get editable fields, and edits go straight into the live world.</li><li><strong>Query</strong> — type query expressions and see matches update in real time, including query plans and profiling.</li><li><strong>Watch</strong> — frame time, entity counts and per-system timing graphs, fed by the stats endpoints.</li><li><strong>Script</strong> — edit Flecs scripts with errors shown inline, hot-reloading the scene as you type.</li></ul>"
      },
      {
        type: "diagram",
        heading: "How the connection works",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "ex", label: "Explorer", sub: "web app in your browser" } ],
            [ { id: "http", label: "HTTP server", sub: "localhost:27750, own thread" } ],
            [ { id: "rest", label: "REST handlers", sub: "run inside your frame" } ],
            [ { id: "wld", label: "Your world", sub: "entities, queries, stats" } ]
          ],
          edges: [
            { from: "ex", to: "http", label: "GET /query, PUT /component..." },
            { from: "http", to: "rest", label: "queued until frame end" },
            { from: "rest", to: "wld", label: "serialize / mutate" },
            { from: "wld", to: "ex", label: "JSON replies", dashed: true }
          ],
          note: "The page is served from flecs.dev, but all your data travels only between the browser and your app on localhost."
        }
      },
      {
        type: "text",
        heading: "Why a website can talk to your app at all",
        html: "<p>Browsers normally forbid a page from one site talking to a server on another — a safety rule called <em>CORS</em> (cross-origin resource sharing) — unless the server explicitly says it's fine. The embedded HTTP server does exactly that: every reply carries <code>Access-Control-Allow-Origin: *</code>, and it answers the browser's preflight OPTIONS check, including the header modern browsers require before letting a public website reach a private localhost address. That handshake is the whole trick: your data never touches flecs.dev, it goes browser-to-localhost directly.</p><p>The Explorer isn't limited to localhost either. It can connect to a remote host serving the REST API, or even to a Flecs app compiled to WebAssembly running in the same page — wasm builds export a <code>flecs_explorer_request</code> function, and the Explorer pushes requests through it with no network at all. There's also <code>flecs.js</code>, a small client library, if you'd rather build your own web tool on the same connection.</p>"
      },
      {
        type: "text",
        heading: "Good habits",
        html: "<ul><li>Import <code>FlecsStats</code> or the performance tab stays empty.</li><li>Register reflection data for your components, or the Explorer shows them as opaque blobs it can't edit.</li><li>The server listens on all interfaces by default; on a shared network, set <code>ipaddr</code> to <code>\"127.0.0.1\"</code> so only your machine can connect.</li><li>Remember it's a development tool — anyone who can reach the port can edit your world.</li></ul>"
      }
    ],
    related: ["net-rest-enable", "reflection", "observability", "script"]
  }
]);
