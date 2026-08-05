window.FLECS_TOUR.register([
  {
    id: "rfl-why",
    parent: "reflection",
    order: 1,
    title: "Why Reflection?",
    code: "RFL-01",
    tagline: "Once Flecs knows the shape of your data, tools come free",
    intro: "Normally a C program treats a struct as an opaque block of bytes: the compiler knows there's a float called <code>x</code> in there, but that knowledge is thrown away at compile time. Reflection means keeping that knowledge around at runtime, so Flecs can look at any component and know what's inside it.",
    sections: [
      {
        type: "text",
        heading: "The label on the box",
        html: "<p>Imagine a warehouse full of sealed boxes. Without labels, you can move boxes around, but you can't tell anyone what's inside, check if the contents are damaged, or repack a box. Reflection is the label: a description that says &quot;this box contains two floats named x and y&quot;.</p><p>The <strong>meta addon</strong> stores these labels. And in true Flecs fashion, a type description is not some separate registry — it's just entities and components. Your <code>Position</code> component is an entity, and describing it means adding components like <code>EcsStruct</code> to that entity. That means you can query types, name them, put them in hierarchies, and serialize the descriptions themselves.</p>"
      },
      {
        type: "text",
        heading: "What you get for the effort",
        html: "<p>Describe a type once, and every generic tool in Flecs can handle values of it:</p><ul><li><strong>Printing.</strong> <code>ecs_ptr_to_expr()</code> turns any described value into a readable string — priceless when debugging.</li><li><strong>JSON.</strong> The JSON addon serializes and deserializes any described component, which powers saving, loading and the remote API.</li><li><strong>The Explorer.</strong> The web-based Flecs Explorer shows and lets you <em>edit</em> component values live, with sliders and ranges, because reflection tells it what the fields are.</li><li><strong>Flecs Script.</strong> When a script says <code>Position: {x: 10, y: 20}</code>, reflection is what maps those names and numbers onto your C struct.</li><li><strong>Runtime types.</strong> You can invent whole new component types while the program runs — no recompile.</li></ul>"
      },
      {
        type: "diagram",
        heading: "One description, many consumers",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "you", label: "You describe a type", sub: "ecs_struct, ecs_enum, ..." } ],
            [ { id: "meta", label: "Meta addon", sub: "type entities + serializer" } ],
            [ { id: "json", label: "JSON addon", sub: "save / load / REST" },
              { id: "script", label: "Flecs Script", sub: "assign values from text" },
              { id: "expl", label: "Explorer", sub: "inspect & edit live" },
              { id: "dbg", label: "Debug strings", sub: "ecs_ptr_to_expr" } ],
          ],
          edges: [
            { from: "you", to: "meta" },
            { from: "meta", to: "json" },
            { from: "meta", to: "script" },
            { from: "meta", to: "expl" },
            { from: "meta", to: "dbg" }
          ],
          note: "Everything on the right is generic code that works for any type you describe."
        }
      }
    ],
    related: ["rfl-describing", "script", "remote"]
  },
  {
    id: "rfl-describing",
    parent: "reflection",
    order: 2,
    title: "Describing Types",
    code: "RFL-02",
    tagline: "Types are entities with components that explain their layout",
    intro: "In Flecs a type is an entity, and describing it means attaching reflection components to that entity. Every described type gets an <code>EcsType</code> component that says what <em>kind</em> of type it is, plus a kind-specific component — <code>EcsStruct</code> for structs, <code>EcsEnum</code> for enums, and so on — with the details.",
    sections: [
      {
        type: "text",
        heading: "Anatomy of a type entity",
        html: "<p>Take the <code>Position</code> component. As an entity, it carries:</p><ul><li><code>EcsComponent</code> — the core component that stores size and alignment, so the storage engine can allocate space for it. Every component has this, described or not.</li><li><code>EcsType</code> — added by the meta addon; its <code>kind</code> field says which family the type belongs to.</li><li>A kind component — for Position that's <code>EcsStruct</code>, holding the list of members.</li><li><code>EcsTypeSerializer</code> — a pre-compiled instruction list that serializers use to walk values fast. Flecs builds this for you automatically.</li></ul><p>The <code>kind</code> field is an <code>ecs_type_kind_t</code>, and there are nine kinds: <code>EcsPrimitiveType</code> (single values like a float), <code>EcsStructType</code>, <code>EcsEnumType</code>, <code>EcsBitmaskType</code>, <code>EcsArrayType</code>, <code>EcsVectorType</code>, <code>EcsMapType</code> (key-value pairs), <code>EcsOpaqueType</code> (types you don't control), and <code>EcsValueType</code> (a value that carries its own type at runtime).</p>"
      },
      {
        type: "diagram",
        heading: "A described type, as stored",
        spec: {
          type: "stack",
          layers: [
            { label: "Position (an entity)", sub: "may have a name, a parent, docs..." },
            { label: "EcsComponent", sub: "size: 8, alignment: 4" },
            { label: "EcsType", sub: "kind: EcsStructType" },
            { label: "EcsStruct", sub: "members: x (f32), y (f32)" },
            { label: "EcsTypeSerializer", sub: "compiled instructions, built automatically" }
          ],
          note: "Reflection data is ordinary component data on the type's own entity."
        }
      },
      {
        type: "text",
        heading: "Two ways to describe",
        html: "<p>You can describe types at two levels:</p><ul><li><strong>Convenience initializers</strong> like <code>ecs_struct_init()</code>, <code>ecs_enum_init()</code>, <code>ecs_array_init()</code> — fill in a small descriptor struct and get a type entity back. This is what you'll use nearly always.</li><li><strong>Raw entities</strong> — because it's all just entities and components, you can also build a struct by creating child entities with an <code>EcsMember</code> component, or an enum by adding child entities with the <code>Constant</code> tag. The initializers do exactly this under the hood.</li></ul><p>The pages below cover each kind of type in detail.</p>"
      }
    ],
    related: ["rfl-primitives", "rfl-structs", "components", "cmp-registration"]
  },
  {
    id: "rfl-primitives",
    parent: "rfl-describing",
    order: 1,
    title: "Primitives",
    code: "RFL-02A",
    tagline: "The atoms every other type is built from",
    intro: "Primitives are the smallest describable values: booleans, characters, integers of various sizes, floats, strings, and entity ids. Flecs pre-registers all of them as builtin type entities like <code>ecs_f32_t</code>, so when you describe a struct you just point members at these.",
    sections: [
      {
        type: "text",
        heading: "Builtin and ready to use",
        html: "<p>Every primitive kind has a matching typedef (so you can use it in C) and a pre-registered type entity (so you can reference it in reflection). For example <code>ecs_f32_t</code> is a typedef for <code>float</code>, and <code>ecs_id(ecs_f32_t)</code> is the entity that describes it. A primitive type entity carries an <code>EcsPrimitive</code> component whose single field, <code>kind</code>, is one of the <code>ecs_primitive_kind_t</code> values below.</p><p>Two of them deserve a callout: <code>EcsEntity</code> and <code>EcsId</code> mean a field holds a reference to another entity or a component id. Serializers turn these into entity <em>names</em> instead of raw numbers, which is what makes saved files readable and stable.</p><p><code>EcsString</code> fields (<code>char*</code>) are owned by the component: reflection-aware code knows to copy and free them correctly.</p>"
      },
      {
        type: "diagram",
        heading: "All eighteen primitive kinds",
        spec: {
          type: "grid",
          title: "ecs_primitive_kind_t",
          cols: ["Kind", "C type", "What it is"],
          rows: [
            ["EcsBool", "bool", "true or false"],
            ["EcsChar", "char", "one character"],
            ["EcsByte", "unsigned char", "one raw byte"],
            ["EcsU8 / EcsU16 / EcsU32 / EcsU64", "uint8..64_t", "unsigned whole numbers, 4 sizes"],
            ["EcsI8 / EcsI16 / EcsI32 / EcsI64", "int8..64_t", "signed whole numbers, 4 sizes"],
            ["EcsF32 / EcsF64", "float / double", "decimal numbers, 2 sizes"],
            ["EcsUPtr / EcsIPtr", "uintptr_t / intptr_t", "pointer-sized integers"],
            ["EcsString", "char*", "owned text, copied and freed for you"],
            ["EcsEntity", "ecs_entity_t", "reference to an entity, saved by name"],
            ["EcsId", "ecs_id_t", "a component or pair id, saved by name"]
          ],
          note: "Use them in members as ecs_id(ecs_f32_t), ecs_id(ecs_string_t), and so on."
        }
      },
      {
        type: "code",
        heading: "Primitives are components too",
        lang: "c",
        title: "You can attach a bare primitive to an entity",
        src: "ecs_entity_t e = ecs_new(world);\necs_set(world, e, ecs_i32_t, {10});\necs_set(world, e, ecs_string_t, {\"hello\"});"
      }
    ],
    related: ["rfl-structs", "rfl-enums", "rfl-bitmasks"]
  },
  {
    id: "rfl-enums",
    parent: "rfl-describing",
    order: 2,
    title: "Enums",
    code: "RFL-02B",
    tagline: "A value that must be exactly one of a set of named options",
    intro: "An enum is a traffic light: the value is Red, Orange or Green, and never two at once. In C it is stored as a plain integer, which means a tool looking at the bytes only sees <code>2</code>. Describing the enum tells Flecs the names, so everything that reads or writes your data can say <code>Green</code> instead.",
    sections: [
      {
        type: "code",
        heading: "Describing an enum",
        lang: "c",
        title: "Constants get values 0, 1, 2 unless you say otherwise",
        src: "typedef enum {\n  Red, Orange, Green\n} TrafficLight;\n\nECS_COMPONENT(world, TrafficLight);\n\necs_enum(world, {\n  .entity = ecs_id(TrafficLight),\n  .constants = {\n    { .name = \"Red\" },\n    { .name = \"Orange\" },\n    { .name = \"Green\" }\n  }\n});"
      },
      {
        type: "text",
        heading: "Constants are child entities",
        html: "<p>Just like struct members, each constant becomes a child entity of the type, tagged with <code>Constant</code>. Values are assigned in order (0, 1, 2...) unless you supply one. To pick a value yourself, set the pair <code>(Constant, i32)</code> on the constant entity — or fill in the <code>value</code> field of the constant descriptor and let Flecs do it.</p><p>Because constants are entities, they show up in the tour of your world like everything else: you can look them up by name, document them, and reference them from script.</p>"
      },
      {
        type: "struct",
        heading: "The datatypes",
        name: "EcsEnum / ecs_enum_constant_t",
        summary: "What gets stored on the type entity, and what each constant descriptor holds.",
        members: [
          { name: "EcsEnum.underlying_type", type: "ecs_entity_t", desc: "Which integer type the enum is stored as. An enum can occupy one byte or eight, and a serializer has to know which before it can read the value." },
          { name: "constant.name", type: "const char*", desc: "The name of the constant. Required when describing the enum." },
          { name: "constant.value", type: "int64_t", desc: "The numeric value, when the underlying type is signed. Left out, values count up from zero." },
          { name: "constant.value_unsigned", type: "uint64_t", desc: "The numeric value when the underlying type is unsigned." },
          { name: "constant.constant", type: "ecs_entity_t", desc: "The entity Flecs created for this constant. Filled in for you — do not set it yourself." }
        ]
      },
      {
        type: "text",
        heading: "What it buys you",
        html: "<p>A described enum is one that every part of Flecs can talk about in words:</p><ul><li>JSON says <code>\"Green\"</code>, not <code>2</code>, so a saved scene survives you reordering the enum later.</li><li>Flecs Script can assign <code>Green</code> by name, and the expression engine converts it for you.</li><li>The explorer shows a dropdown of the real options instead of a number field.</li><li>A companion <code>EcsConstants</code> component holds the lookup structures — a map from value to constant, and the constants in registration order — so those conversions cost a hash lookup, not a scan.</li></ul><p>An enum can also be used as a relationship target directly, which is a separate feature but the same idea: names beat numbers.</p>"
      }
    ],
    related: ["rfl-bitmasks", "rfl-primitives", "rfl-cursor-conversions"]
  },
  {
    id: "rfl-bitmasks",
    parent: "rfl-describing",
    order: 3,
    title: "Bitmasks",
    code: "RFL-02C",
    tagline: "Named switches you can flip in any combination",
    intro: "A bitmask is a pizza order: cheese and pepperoni and mushrooms, any mix you like. Where an enum picks exactly one option, a bitmask packs a row of on/off switches into one integer — and describing it lets Flecs print <code>Cheese|Pepperoni</code> instead of <code>3</code>.",
    sections: [
      {
        type: "code",
        heading: "Describing a bitmask",
        lang: "c",
        title: "Each constant is its own bit",
        src: "typedef uint32_t Toppings;\n#define Cheese    (1u << 0)\n#define Pepperoni (1u << 1)\n#define Mushroom  (1u << 2)\n\nECS_COMPONENT(world, Toppings);\n\necs_bitmask(world, {\n  .entity = ecs_id(Toppings),\n  .constants = {\n    { .name = \"Cheese\",    .value = Cheese },\n    { .name = \"Pepperoni\", .value = Pepperoni },\n    { .name = \"Mushroom\",  .value = Mushroom }\n  }\n});"
      },
      {
        type: "text",
        heading: "Powers of two, on purpose",
        html: "<p>Bitmask values must not overlap: each constant owns exactly one bit, so the values run 1, 2, 4, 8 and so on. That is what makes combining them a bitwise or, and testing one a bitwise and. If you leave the values out, Flecs assigns the next free bit for you.</p><p>Constants are child entities of the type, tagged with <code>Constant</code>, exactly like enum constants. The difference is the pair used to store the value: bitmask constants use <code>(Constant, u32)</code>, since a bit pattern is naturally unsigned.</p>"
      },
      {
        type: "diagram",
        heading: "One choice vs. many switches",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "en", label: "Enum: TrafficLight", sub: "value is ONE of..." },
              { id: "bm", label: "Bitmask: Toppings", sub: "value is ANY MIX of..." } ],
            [ { id: "ec", label: "Red=0, Orange=1, Green=2", sub: "stored as one integer" },
              { id: "bc", label: "Cheese=1, Pepperoni=2, Mushroom=4", sub: "stored as combined bits: 3 = Cheese|Pepperoni" } ]
          ],
          edges: [
            { from: "en", to: "ec" },
            { from: "bm", to: "bc" }
          ],
          note: "Same storage — one integer — but the described meaning is completely different."
        }
      },
      {
        type: "text",
        heading: "Reading and writing by name",
        html: "<p>With the description in place, a bitmask value converts both ways:</p><ul><li>Serialized out, the value becomes a list of the names whose bits are set.</li><li>Read back in, a string like <code>Cheese|Mushroom</code> is turned into the right integer — the meta cursor accepts constant names wherever a bitmask value is expected.</li><li>A bit that matches no constant is preserved as a number, so unknown flags do not silently vanish.</li></ul><p>The <code>EcsBitmask</code> component itself carries no data: the type entity's children are the description. Use a bitmask when the options genuinely combine, and an enum when exactly one must win — mixing them up produces data that looks fine and reads wrong.</p>"
      }
    ],
    related: ["rfl-enums", "rfl-cursor-conversions", "rfl-serializer"]
  },
  {
    id: "rfl-structs",
    parent: "rfl-describing",
    order: 4,
    title: "Structs & Members",
    code: "RFL-02D",
    tagline: "Name each field, and Flecs figures out where it lives",
    intro: "A struct description is a list of members: each has a name, a type, and an offset — how many bytes into the struct the field starts. You give Flecs the names and types with <code>ecs_struct_init()</code>; offsets are computed for you using the same layout rules the C compiler uses.",
    sections: [
      {
        type: "code",
        heading: "Describing a struct",
        lang: "c",
        title: "The type entity doubles as the component id",
        src: "typedef struct {\n  float x, y;\n} Position;\n\nECS_COMPONENT(world, Position);\n\necs_struct(world, {\n  .entity = ecs_id(Position),\n  .members = {\n    { .name = \"x\", .type = ecs_id(ecs_f32_t) },\n    { .name = \"y\", .type = ecs_id(ecs_f32_t) }\n  }\n});"
      },
      {
        type: "text",
        heading: "Members are entities, structs nest",
        html: "<p>Each member becomes a child entity of the type, carrying an <code>EcsMember</code> component. Adding a child with <code>EcsMember</code> to any entity automatically makes the parent a struct type — the initializer is just a convenient way to do that. Because members are entities, tools can address a field as a path, like <code>Position.x</code>.</p><p>Members can themselves be struct types, so descriptions nest: a <code>Transform</code> can have a member of type <code>Position</code>. A member can also be a fixed-size inline array — set <code>count</code> to the number of elements, matching a C field like <code>float points[4]</code>.</p>"
      },
      {
        type: "struct",
        heading: "The member descriptor",
        name: "ecs_member_t",
        summary: "One entry in a struct description. You fill in a few of these in ecs_struct_desc_t; Flecs fills in the rest.",
        members: [
          { name: "name", type: "const char *", desc: "The field's name, like \"x\". Required." },
          { name: "type", type: "ecs_entity_t", desc: "The entity of the member's type, like ecs_id(ecs_f32_t) or another struct type." },
          { name: "count", type: "int32_t", desc: "For inline arrays: how many elements, matching a C field like float v[3]. Leave 0 for a normal field." },
          { name: "offset", type: "int32_t", desc: "How many bytes into the struct the field starts. Usually left 0 so Flecs computes it with C layout rules." },
          { name: "unit", type: "ecs_entity_t", desc: "Optional unit for the value, like meters or seconds. Auto-filled if the member's type entity is itself a unit." },
          { name: "use_offset", type: "bool", desc: "Set to true to make Flecs trust your offset instead of computing one. Needed when members are registered out of order or the C layout differs from what auto-computation would guess." },
          { name: "range", type: "ecs_member_value_range_t", desc: "Min and max values the field may hold. UIs like the Explorer use it for sliders and progress bars." },
          { name: "error_range", type: "ecs_member_value_range_t", desc: "Values outside this range mean something is wrong; UIs can color the field red." },
          { name: "warning_range", type: "ecs_member_value_range_t", desc: "Values outside this range deserve attention; UIs can color the field yellow." },
          { name: "size", type: "ecs_size_t", desc: "Byte size of the member. Filled in by Flecs; don't set it yourself." },
          { name: "member", type: "ecs_entity_t", desc: "The child entity created for this member. Filled in by Flecs; don't set it yourself." }
        ]
      },
      {
        type: "diagram",
        heading: "Description vs. bytes",
        spec: {
          type: "grid",
          title: "How members map onto a struct's memory",
          cols: ["Member", "Type", "Offset", "Bytes"],
          rows: [
            ["x", "ecs_f32_t", "0", "4"],
            ["y", "ecs_f32_t", "4", "4"],
            ["health", "ecs_i32_t", "8", "4"],
            ["name", "ecs_string_t", "16", "8"]
          ],
          note: "Note the gap before offset 16: alignment padding, exactly as a C compiler would insert."
        }
      },
      {
        type: "text",
        heading: "Partial reflection",
        html: "<p>You don't have to describe every field. If a struct has fields you want to keep private — a cached pointer, an internal handle — describe only the interesting ones and give explicit offsets with <code>offset</code> plus <code>use_offset: true</code> (the C macro <code>offsetof()</code> gives you the number). Flecs marks the type as <em>partial</em> and tools will show and edit just the described fields.</p><p>The <code>use_offset</code> flag matters because an offset of 0 is a perfectly valid offset for a first member — the boolean is how you say &quot;yes, I really mean this offset&quot; rather than &quot;please compute one&quot;. Flecs preserves this flag on the member entity it creates, so a description that round-trips through entities keeps its exact layout.</p>"
      }
    ],
    related: ["rfl-primitives", "rfl-units", "rfl-cursor", "rfl-collections"]
  },
  {
    id: "rfl-collections",
    parent: "rfl-describing",
    order: 5,
    title: "Collections",
    code: "RFL-02E",
    tagline: "Egg cartons, shopping lists, and phone books",
    intro: "Some members hold many values instead of one. Flecs describes three shapes of that: an <em>array</em> with a fixed number of slots, a <em>vector</em> that grows and shrinks, and a <em>map</em> that finds values by key. Each is a type entity like any other, so a collection can hold structs, and a struct can hold collections.",
    sections: [
      {
        type: "text",
        heading: "Three shapes, one idea",
        html: "<p>All three say the same thing — \"here are many values of type X\" — and differ in where the values live and how you reach them:</p><ul><li>An <strong>array</strong> is an egg carton: the number of slots is decided when you describe the type, and the values sit directly inside the component's own memory.</li><li>A <strong>vector</strong> is a shopping list: each value can have a different length, so the elements live in a buffer the component points at.</li><li>A <strong>map</strong> is a phone book: values are found by key rather than by position.</li></ul><p>Element types can be anything Flecs knows about — primitives, structs, enums, even other collections — so \"a vector of structs that each contain an array\" describes fine.</p>"
      },
      {
        type: "diagram",
        heading: "Where the elements live",
        spec: {
          type: "grid",
          title: "Same element type, different shape",
          cols: ["Kind", "Length", "Where elements live", "Described with"],
          rows: [
            ["Array", "fixed when described", "inline, inside the component", "ecs_array_init()"],
            ["Vector", "whatever each value holds", "a growable buffer the component points to", "ecs_vector_init()"],
            ["Map", "whatever each value holds", "a lookup structure, found by key", "ecs_map_type_init()"]
          ],
          note: "Only the array's size is part of the type. The other two carry their length with the value."
        }
      },
      {
        type: "text",
        heading: "Owned memory changes the rules",
        html: "<p>An array is just bytes, so a component containing one copies and destroys like any struct. A vector or a map owns memory <em>outside</em> the component, which means copying such a component has to copy the buffer, and destroying it has to free the buffer.</p><p>When a type is built from reflection data alone, Flecs generates those routines for you — the constructor, copy, move and destructor hooks come out of the description. That is what makes it possible to invent a component type at runtime that contains a vector and still have it behave correctly when entities are created, cloned and deleted.</p>"
      }
    ],
    related: ["rfl-runtime-types", "rfl-structs", "int-vec-allocators"]
  },
  {
    id: "rfl-arrays",
    parent: "rfl-collections",
    order: 1,
    title: "Arrays",
    code: "RFL-02E1",
    tagline: "A fixed number of slots, sitting inside the value itself",
    intro: "An array type is <code>float values[8]</code>: eight slots, decided when you describe the type, stored one after another inside whatever contains them. It is the simplest collection because there is nothing to allocate and nothing to free — the slots are part of the value.",
    sections: [
      {
        type: "code",
        heading: "Describing an array type",
        lang: "c",
        title: "Eight floats, as a named type you can use anywhere",
        src: "ecs_entity_t Waypoints = ecs_array(world, {\n  .entity = ecs_entity(world, { .name = \"Waypoints\" }),\n  .type = ecs_id(ecs_f32_t),\n  .count = 8\n});\n\nECS_COMPONENT(world, Path);\n\necs_struct(world, {\n  .entity = ecs_id(Path),\n  .members = {\n    { .name = \"points\", .type = Waypoints },\n    { .name = \"length\", .type = ecs_id(ecs_i32_t) }\n  }\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsArray",
        summary: "Added to the type entity. Two fields say everything about the shape.",
        members: [
          { name: "type", type: "ecs_entity_t", desc: "The element type. Any described type will do — a primitive, a struct, an enum, or another collection." },
          { name: "count", type: "int32_t", desc: "How many elements. Part of the type itself, which is why every value of this type has exactly this many." }
        ]
      },
      {
        type: "text",
        heading: "The inline shortcut",
        html: "<p>Describing a separate array type is worth it when the array is a type in its own right that several structs share. For a one-off member, you do not need to: a struct member descriptor has a <code>count</code> field, and setting it turns that member into an inline array of the member's type.</p><p>Either way the layout is identical — element size times count, laid out end to end — and the size of the whole type is computed from the description, so it matches what the C compiler produced for your struct.</p>"
      },
      {
        type: "text",
        heading: "How it reads and writes",
        html: "<ul><li>Serialized to JSON, an array becomes a list: <code>[1, 2, 3]</code>.</li><li>The meta cursor walks it with <code>ecs_meta_push</code> to step into the array, <code>ecs_meta_next</code> to move between elements, and <code>ecs_meta_pop</code> to step back out.</li><li>Writing more elements than the type has is an error rather than a silent grow — the count is part of the type.</li><li>Because everything is inline, an array member needs no special construct or destruct work beyond what its element type already needs.</li></ul>"
      }
    ],
    related: ["rfl-vectors", "rfl-structs", "rfl-cursor"]
  },
  {
    id: "rfl-vectors",
    parent: "rfl-collections",
    order: 2,
    title: "Vectors",
    code: "RFL-02E2",
    tagline: "A list that grows, with its elements kept outside the value",
    intro: "A vector type is a shopping list: this value holds three items, that one holds forty. The type says what the elements are, but not how many — so the elements cannot sit inside the value. They live in a buffer the value points at, and that pointer is the part that needs care.",
    sections: [
      {
        type: "code",
        heading: "Describing a vector type",
        lang: "c",
        title: "The type fixes the element type, not the length",
        src: "ecs_entity_t Inventory = ecs_vector(world, {\n  .entity = ecs_entity(world, { .name = \"Inventory\" }),\n  .type = ecs_id(ecs_string_t)\n});\n\nECS_COMPONENT(world, Backpack);\n\necs_struct(world, {\n  .entity = ecs_id(Backpack),\n  .members = {\n    { .name = \"items\", .type = Inventory }\n  }\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsVector",
        summary: "One field. Everything else about a vector value is decided per value, not per type.",
        members: [
          { name: "type", type: "ecs_entity_t", desc: "The element type. The number of elements is stored with each value, in the growable list Flecs uses to represent it." }
        ]
      },
      {
        type: "text",
        heading: "It is a real ecs_vec_t",
        html: "<p>A vector-typed value is Flecs' own growable list: a pointer to the elements, a count, and a capacity. That is the same container the storage engine uses internally, so a vector member is not a special reflection-only construct — it is a data structure your C code can read and manipulate directly.</p><p>Growing follows the usual rule: when the capacity is used up, the buffer is reallocated with room to spare, so appending is cheap on average and occasionally expensive.</p>"
      },
      {
        type: "text",
        heading: "Owned memory means lifecycle work",
        html: "<p>Because the elements live outside the value, a component containing a vector cannot be copied with a plain memory copy, and forgetting it leaks:</p><ul><li><strong>Copy</strong> has to allocate a new buffer and copy the elements into it, or two components end up sharing — and later double-freeing — one buffer.</li><li><strong>Move</strong> can hand the buffer over and leave the source empty, which is why moves are cheap and copies are not.</li><li><strong>Destruct</strong> has to destruct the elements and free the buffer.</li></ul><p>For types created from reflection data, Flecs generates all of that from the description. For a type you registered from C, describing a member as a vector tells the serializers what to do, but the component's own hooks are still yours to provide.</p><p>Serialized out, a vector is a JSON list, exactly like an array. Read back in, the cursor grows the vector as elements arrive instead of erroring on the fourth one.</p>"
      }
    ],
    related: ["rfl-arrays", "rfl-runtime-types", "int-vec-allocators"]
  },
  {
    id: "rfl-maps",
    parent: "rfl-collections",
    order: 3,
    title: "Maps",
    code: "RFL-02E3",
    tagline: "Values you find by key instead of by position",
    intro: "A map type is a phone book: you do not walk it looking for entry seventeen, you look up a name and get a number. Describing one tells Flecs both halves — what the keys are and what the values are — so a map-typed member can be serialized, edited and rebuilt like any other data.",
    sections: [
      {
        type: "code",
        heading: "Describing a map type",
        lang: "c",
        title: "Keys are entity ids here, values are floats",
        src: "ecs_entity_t Reputation = ecs_map_type(world, {\n  .entity = ecs_entity(world, { .name = \"Reputation\" }),\n  .key_type = ecs_id(ecs_u64_t),\n  .type = ecs_id(ecs_f32_t)\n});\n\nECS_COMPONENT(world, Faction);\n\necs_struct(world, {\n  .entity = ecs_id(Faction),\n  .members = {\n    { .name = \"standing\", .type = Reputation }\n  }\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsMap",
        summary: "Added to the type entity. Two types: one for the key, one for the value.",
        members: [
          { name: "key_type", type: "ecs_entity_t", desc: "The key type. It must be something that can be hashed and compared reliably: a primitive that is not a string, f32 or f64, or an enum or bitmask." },
          { name: "type", type: "ecs_entity_t", desc: "The value type. Anything described will do, including structs and other collections." }
        ]
      },
      {
        type: "text",
        heading: "Why the key type is restricted",
        html: "<p>Keys have to answer one question exactly: are these two the same? Floating point numbers are bad at that — two values that print the same can differ in the last bit — and strings would mean the map owns the memory its keys point at. Ruling both out keeps map keys to plain integers and named constants, where equality is unambiguous and the key can be stored by value.</p><p>Enums and bitmasks are allowed because they are integers underneath, with the bonus that a serialized map can use the constant's name as the key.</p>"
      },
      {
        type: "text",
        heading: "Reading and writing",
        html: "<ul><li>Serialized out, a map becomes a JSON object: each key is rendered with its own type's rules, and each value follows.</li><li>Read back in, the entries are added to the map as they arrive, so a map value does not need to be empty first.</li><li>Like a vector, a map owns memory outside the value, so copying and destroying a component containing one is real work — generated for you when the type itself was built from reflection data.</li><li>If you only ever need a fixed set of named slots, a struct is a better fit: it is faster to reach, and the names are part of the type instead of part of the data.</li></ul>"
      }
    ],
    related: ["rfl-vectors", "rfl-enums", "int-maps"]
  },
  {
    id: "rfl-opaque",
    parent: "rfl-describing",
    order: 6,
    title: "Opaque Types",
    code: "RFL-02F",
    tagline: "Describe types you don't control by teaching Flecs to talk to them",
    intro: "Some types can't be described field-by-field because their insides are hidden or unusual: a C++ <code>std::string</code>, a handle from another library, a class that only exposes getters and setters. An <em>opaque type</em> is the escape hatch: instead of describing the layout, you provide small functions that read from and write to the value on Flecs' behalf.",
    sections: [
      {
        type: "text",
        heading: "The translator analogy",
        html: "<p>Think of an opaque type as hiring a translator. Flecs never opens the box itself; it asks your translator two kinds of questions:</p><ul><li><strong>&quot;Tell me what's in there&quot;</strong> — your <code>serialize</code> callback walks the value and reports its contents through a small <code>ecs_serializer_t</code> interface (call <code>ser-&gt;value()</code> for each value, <code>ser-&gt;member()</code> to name a field first).</li><li><strong>&quot;Put this in there&quot;</strong> — the <code>assign_*</code> callbacks accept a value of a given kind (bool, int, float, string...) and store it however your type wants.</li></ul><p>You also declare <code>as_type</code>: the described type your opaque type <em>behaves like</em>. A string-like handle maps to <code>ecs_string_t</code>; a growable list maps to a vector type; a getter/setter class maps to a struct type. Serializers then treat your type exactly like that type.</p>"
      },
      {
        type: "code",
        heading: "An opaque string",
        lang: "c",
        title: "A library type that stores text some private way",
        src: "typedef struct { char *data; int length; } MyString;\n\nstatic int MyString_serialize(const ecs_serializer_t *ser, const void *src) {\n  const MyString *str = src;\n  return ser->value(ser, ecs_id(ecs_string_t), &str->data);\n}\n\nstatic void MyString_assign_string(void *dst, const char *value) {\n  MyString *str = dst;\n  mystring_set(str, value);\n}\n\nECS_COMPONENT(world, MyString);\n\necs_opaque(world, {\n  .entity = ecs_id(MyString),\n  .type = {\n    .as_type = ecs_id(ecs_string_t),\n    .serialize = MyString_serialize,\n    .assign_string = MyString_assign_string\n  }\n});"
      },
      {
        type: "struct",
        heading: "The opaque type interface",
        name: "EcsOpaque",
        summary: "The component you attach to an opaque type. Fill in only the callbacks that make sense for your type; if a deserializer needs one you didn't provide, it reports a conversion error.",
        members: [
          { name: "as_type", type: "ecs_entity_t", desc: "The described type this opaque type behaves like — the shape of its serialized form." },
          { name: "serialize", type: "ecs_meta_serialize_t", desc: "Called to read the whole value. You report contents via ser->value() and ser->member()." },
          { name: "serialize_member", type: "ecs_meta_serialize_member_t", desc: "Called to read one named field of an opaque struct, without serializing the rest." },
          { name: "serialize_element", type: "ecs_meta_serialize_element_t", desc: "Called to read one element of an opaque array or vector, by index." },
          { name: "assign_bool", type: "void (*)(void*, bool)", desc: "Store a true/false value into the opaque value." },
          { name: "assign_char", type: "void (*)(void*, char)", desc: "Store a character." },
          { name: "assign_int", type: "void (*)(void*, int64_t)", desc: "Store a signed whole number." },
          { name: "assign_uint", type: "void (*)(void*, uint64_t)", desc: "Store an unsigned whole number." },
          { name: "assign_float", type: "void (*)(void*, double)", desc: "Store a decimal number." },
          { name: "assign_string", type: "void (*)(void*, const char*)", desc: "Store text. Your callback decides how to copy it." },
          { name: "assign_entity", type: "void (*)(void*, ecs_world_t*, ecs_entity_t)", desc: "Store an entity reference. Gets the world too, in case you need to look things up." },
          { name: "assign_id", type: "void (*)(void*, ecs_world_t*, ecs_id_t)", desc: "Store a component id." },
          { name: "assign_null", type: "void (*)(void*)", desc: "Clear the value, for when the input says null." },
          { name: "clear", type: "void (*)(void*)", desc: "Remove all elements from an opaque collection." },
          { name: "ensure_element", type: "void* (*)(void*, size_t)", desc: "Grow the collection if needed and return a pointer to the element at an index, so it can be written." },
          { name: "ensure_member", type: "void* (*)(void*, const char*)", desc: "Return a writable pointer to a named field of an opaque struct." },
          { name: "count", type: "size_t (*)(const void*)", desc: "Report how many elements an opaque collection holds." },
          { name: "resize", type: "void (*)(void*, size_t)", desc: "Set the collection to an exact number of elements." }
        ]
      },
      {
        type: "text",
        heading: "When to reach for this",
        html: "<p>Opaque types are the bridge between Flecs and every other library: C++ standard types like <code>std::string</code> and <code>std::vector</code>, math types from your engine, or anything with private fields. The C++ API uses this machinery under the hood to make standard library types serializable. If a type is a plain C struct you own, don't use opaque — a normal struct description is simpler and faster.</p>"
      }
    ],
    related: ["rfl-structs", "rfl-cursor"]
  },
  {
    id: "rfl-cursor",
    parent: "reflection",
    order: 3,
    title: "The Meta Cursor",
    code: "RFL-03",
    tagline: "A finger that points into any value and can read or change it",
    intro: "The meta cursor lets you read and write a value <em>without knowing its type when you wrote your code</em>. You get an <code>ecs_meta_cursor_t</code>, point it at a value, and steer: step into a struct, walk from field to field, jump to a member by name, and set or get whatever the cursor points at.",
    sections: [
      {
        type: "text",
        heading: "Like filling in a form for someone else",
        html: "<p>Imagine filling in a paper form you've never seen before. You don't need to have memorized the form: you look at the current box's label, write something, move to the next box, maybe step into a sub-section, then step back out. The cursor works the same way:</p><ul><li><code>ecs_meta_cursor()</code> creates a cursor for a type and a pointer to a value.</li><li><code>ecs_meta_push()</code> steps <em>into</em> a struct or collection; <code>ecs_meta_pop()</code> steps back out.</li><li><code>ecs_meta_next()</code> moves to the next field or element; <code>ecs_meta_member()</code> jumps to a field by name; <code>ecs_meta_dotmember()</code> even understands paths like <code>&quot;start.x&quot;</code>; <code>ecs_meta_elem()</code> jumps to an element by index.</li><li><code>ecs_meta_set_int()</code>, <code>set_float</code>, <code>set_string</code>, <code>set_bool</code>, <code>set_entity</code> and friends write to the current field; the matching <code>ecs_meta_get_*()</code> functions read it. <code>ecs_meta_get_ptr()</code> hands you a raw pointer to it.</li></ul>"
      },
      {
        type: "code",
        heading: "Writing a struct you've never met",
        lang: "c",
        title: "The same code works for any described type",
        src: "typedef struct {\n  float x, y;\n} Position;\n\nPosition p = {0};\necs_meta_cursor_t cur = ecs_meta_cursor(world, ecs_id(Position), &p);\n\necs_meta_push(&cur);\necs_meta_member(&cur, \"x\");\necs_meta_set_float(&cur, 10);\necs_meta_next(&cur);\necs_meta_set_float(&cur, 20);\necs_meta_pop(&cur);"
      },
      {
        type: "diagram",
        heading: "A cursor walking a nested struct",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "c1", label: "cursor at Line", sub: "value: {start: {x, y}, stop: {x, y}}" } ],
            [ { id: "c2", label: "push", sub: "enter Line, at member start" },
              { id: "c5", label: "next", sub: "move to member stop" } ],
            [ { id: "c3", label: "push", sub: "enter start, at member x" },
              { id: "c4", label: "set_float, next, set_float", sub: "write x, then y" },
              { id: "c6", label: "pop", sub: "leave start, back in Line" } ]
          ],
          edges: [
            { from: "c1", to: "c2" },
            { from: "c2", to: "c3" },
            { from: "c3", to: "c4" },
            { from: "c4", to: "c6" },
            { from: "c6", to: "c5" }
          ],
          note: "Every push must be matched by a pop. The cursor tracks where it is on a scope stack."
        }
      },
      {
        type: "struct",
        heading: "The cursor itself",
        name: "ecs_meta_cursor_t",
        summary: "A small value you create on the stack — no allocation, no cleanup needed. It remembers where in the value it currently points.",
        members: [
          { name: "world", type: "const ecs_world_t *", desc: "The world the type lives in, needed to look up reflection data and entity names." },
          { name: "scope", type: "ecs_meta_scope_t[32]", desc: "The stack of scopes the cursor has pushed into: one entry per nesting level, each tracking the current type, position and value pointer. 32 levels of nesting is the limit." },
          { name: "depth", type: "int16_t", desc: "How many scopes deep the cursor currently is." },
          { name: "valid", type: "bool", desc: "Whether the cursor currently points at a real field. Stepping past the last field clears it." },
          { name: "is_primitive_scope", type: "bool", desc: "Allows one push even when the value is a bare primitive, so generic code that always pushes still works." },
          { name: "lookup_action", type: "function pointer", desc: "Optional custom function for turning names into entities when setting entity fields, replacing the default ecs_lookup(). Deserializers use this to resolve names their own way." },
          { name: "lookup_ctx", type: "void *", desc: "A user pointer passed to lookup_action." }
        ]
      },
      {
        type: "text",
        heading: "Why this is the keystone",
        html: "<p>The cursor is how everything text-shaped gets into your components. When Flecs Script evaluates <code>Position: {x: 10, y: 20}</code>, it drives a cursor. When the JSON addon deserializes a component, it drives a cursor. When the Explorer edits a field over the REST API, that edit becomes JSON, which becomes cursor calls. Write a config-file loader with a cursor and it will handle every component you ever describe, including ones that don't exist yet.</p><p>Handy inspection calls while walking: <code>ecs_meta_get_type()</code> tells you the current field's type, <code>ecs_meta_get_member()</code> its name, <code>ecs_meta_get_unit()</code> its unit, and <code>ecs_meta_is_collection()</code> / <code>ecs_meta_is_map()</code> what kind of scope you're in.</p>"
      }
    ],
    related: ["rfl-cursor-conversions", "script", "remote"]
  },
  {
    id: "rfl-cursor-conversions",
    parent: "rfl-cursor",
    order: 1,
    title: "Cursor Conversions",
    code: "RFL-03A",
    tagline: "Set a float with an int, an enum with a name, and it just works",
    intro: "The cursor's set functions don't require an exact type match: if you call <code>ecs_meta_set_int()</code> on a float field, the value is converted to a float for you. This forgiveness is deliberate — it's what lets data files survive your types changing underneath them.",
    sections: [
      {
        type: "text",
        heading: "Convert on the way in",
        html: "<p>When a set function's value kind doesn't match the field, the cursor converts: an integer becomes a float, a float becomes an integer, a string like <code>&quot;10&quot;</code> becomes the number 10, a number becomes a bool. Setting an enum field with <code>set_string(&quot;Green&quot;)</code> looks up the constant by name; setting an entity field with a string looks up the entity by name (via the cursor's <code>lookup_action</code>, if you installed one). Only when no sensible conversion exists — say, assigning text to a struct — does the operation fail with an error.</p><p>Why it matters: suppose you saved a file when <code>health</code> was an <code>i32</code>, and later you change it to <code>f32</code>. The old file still loads, because the deserializer just says &quot;set 100&quot; and the cursor adapts it to whatever the field is <em>now</em>.</p>"
      },
      {
        type: "text",
        heading: "Reading converts too, mostly",
        html: "<p>The get side mirrors it: <code>ecs_meta_get_int()</code> on a float field rounds for you, <code>ecs_meta_get_float()</code> works on any number-ish field. Two exceptions stay strict, because inventing data would be worse than failing: <code>ecs_meta_get_string()</code> only works on real string fields, and <code>ecs_meta_get_entity()</code> only on entity fields.</p>"
      },
      {
        type: "diagram",
        heading: "One value, many doors",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "s1", label: "set_int(10)" },
              { id: "s2", label: "set_string(\"10\")" },
              { id: "s3", label: "set_float(10.0)" } ],
            [ { id: "conv", label: "cursor conversion", sub: "checks the field's real type" } ],
            [ { id: "field", label: "field: ecs_f32_t x", sub: "ends up as 10.0f either way" } ]
          ],
          edges: [
            { from: "s1", to: "conv" },
            { from: "s2", to: "conv" },
            { from: "s3", to: "conv" },
            { from: "conv", to: "field" }
          ]
        }
      }
    ],
    related: ["rfl-cursor", "script"]
  },
  {
    id: "rfl-serializer",
    parent: "reflection",
    order: 4,
    title: "The Type Serializer",
    code: "RFL-04",
    tagline: "Each type is compiled once into a fast to-do list",
    intro: "Walking reflection data the general way — look up the type, look up its members, look up each member's type — is flexible but slow to repeat thousands of times. So Flecs compiles every described type, once, into a flat list of simple instructions. Serializers then just replay the list.",
    sections: [
      {
        type: "text",
        heading: "The recipe card",
        html: "<p>Think of the difference between understanding cooking and following a recipe card. Reflection data is the cooking knowledge; the serializer is the card: &quot;step 1: write a float at offset 0 named x; step 2: write a float at offset 4 named y&quot;. No decisions, just steps.</p><p>Each step is an <code>ecs_meta_op_t</code> holding an opcode (<code>kind</code>), the field's <code>offset</code> and <code>name</code>, its <code>type</code>, and bookkeeping like <code>op_count</code> — how many instructions to skip to jump over a whole sub-structure, which is what makes skipping a member cheap. The compiled list lives in the <code>EcsTypeSerializer</code> component on the type entity, built automatically whenever reflection data changes. You can see it with <code>ecs_meta_serializer_to_str()</code>.</p>"
      },
      {
        type: "text",
        heading: "The instruction set",
        html: "<p>The opcodes in <code>ecs_meta_op_kind_t</code> fall into four groups:</p><ul><li><strong>Structure:</strong> <code>EcsOpPushStruct</code>, <code>EcsOpPushArray</code>, <code>EcsOpPushVector</code>, <code>EcsOpPushMap</code> open a nested scope, and <code>EcsOpPop</code> closes it — like opening and closing braces.</li><li><strong>Primitives:</strong> one opcode per primitive kind — <code>EcsOpBool</code>, <code>EcsOpI32</code>, <code>EcsOpF32</code>, <code>EcsOpString</code>, <code>EcsOpEntity</code> and the rest — meaning &quot;a value of this kind sits at this offset&quot;.</li><li><strong>Named values:</strong> <code>EcsOpEnum</code> and <code>EcsOpBitmask</code> carry a lookup table from numbers to constant entities, so serializers can emit names.</li><li><strong>Special:</strong> <code>EcsOpOpaqueStruct</code>, <code>EcsOpOpaqueArray</code>, <code>EcsOpOpaqueVector</code> and <code>EcsOpOpaqueValue</code> hand control to an opaque type's callbacks, and <code>EcsOpForward</code> jumps to another type's instruction list — which is how recursive types (a tree node containing tree nodes) stay finite.</li></ul>"
      },
      {
        type: "diagram",
        heading: "A struct, compiled",
        spec: {
          type: "stack",
          layers: [
            { label: "EcsOpPushStruct", sub: "enter Line" },
            { label: "EcsOpPushStruct  name: start, offset: 0", sub: "enter nested Position" },
            { label: "EcsOpF32  name: x, offset: 0" },
            { label: "EcsOpF32  name: y, offset: 4" },
            { label: "EcsOpPop", sub: "leave start" },
            { label: "EcsOpPushStruct  name: stop, offset: 8", sub: "enter nested Position" },
            { label: "EcsOpF32  name: x, offset: 8" },
            { label: "EcsOpF32  name: y, offset: 12" },
            { label: "EcsOpPop", sub: "leave stop" },
            { label: "EcsOpPop", sub: "leave Line" }
          ],
          note: "The ops vector for struct Line { Position start; Position stop; }. Nested types are flattened into one list with absolute offsets."
        }
      },
      {
        type: "text",
        heading: "Who replays the list",
        html: "<p>Every serializer in Flecs is a loop over these instructions: the JSON writer, the expression writer behind <code>ecs_ptr_to_expr()</code>, and the meta cursor itself — each scope on the cursor's stack is really a window into a type's instruction list. Writing your own binary format is the same loop: switch on <code>kind</code>, read at <code>offset</code>, recurse on push.</p>"
      }
    ],
    related: ["rfl-cursor", "remote", "internals"]
  },
  {
    id: "rfl-runtime-types",
    parent: "reflection",
    order: 5,
    title: "Runtime Types",
    code: "RFL-05",
    tagline: "Invent brand-new component types while the program is running",
    intro: "Everything so far described types your C code already knows. But reflection works the other way too: describe a struct that exists in <em>no</em> header file, and Flecs computes its size and layout and turns it into a fully working component — one you can add to entities, query, and serialize.",
    sections: [
      {
        type: "code",
        heading: "A component from thin air",
        lang: "c",
        title: "No typedef anywhere",
        src: "ecs_entity_t Loot = ecs_struct(world, {\n  .entity = ecs_entity(world, { .name = \"Loot\" }),\n  .members = {\n    { .name = \"gold\", .type = ecs_id(ecs_i32_t) },\n    { .name = \"item\", .type = ecs_id(ecs_string_t) }\n  }\n});\n\necs_entity_t chest = ecs_new(world);\necs_add_id(world, chest, Loot);"
      },
      {
        type: "text",
        heading: "The lifecycle problem, solved for you",
        html: "<p>A component type needs more than a size. When an entity moves between tables, its components must be moved; when an entity is copied, they must be copied; when it's deleted, they must be cleaned up. For compile-time types the compiler handles the trivial cases and <em>hooks</em> (see the Components deck) handle the rest. A runtime type has no compiler — so who frees that <code>item</code> string when the chest is deleted?</p><p>Flecs does. When a type is created from reflection data, the meta addon generates the hooks automatically:</p><ul><li>For <strong>structs</strong>, it scans the members and builds constructor, destructor, move and copy routines that forward to each member's own hooks at the right offsets — the string member gets string handling, the int members get simple byte copies. If no member needs real work, no hook is installed at all, keeping trivial types at full speed.</li><li>For <strong>arrays</strong>, hooks apply the element type's hooks to each of the <code>count</code> elements.</li><li>For <strong>vectors and maps</strong>, hooks manage the owned buffer and construct or destroy each element.</li></ul>"
      },
      {
        type: "diagram",
        heading: "Generated hooks forward to member hooks",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "del", label: "chest deleted", sub: "Loot must be destructed" } ],
            [ { id: "dtor", label: "generated Loot dtor", sub: "built from reflection data" } ],
            [ { id: "gold", label: "gold: i32", sub: "trivial, nothing to do" },
              { id: "item", label: "item: ecs_string_t", sub: "string dtor frees the text" } ]
          ],
          edges: [
            { from: "del", to: "dtor" },
            { from: "dtor", to: "gold", dashed: true },
            { from: "dtor", to: "item" }
          ],
          note: "The generated hook walks a prebuilt list of member offsets and calls each member type's hook."
        }
      },
      {
        type: "text",
        heading: "Comparing runtime values",
        html: "<p>Two related helpers generate comparison hooks from reflection data: <code>ecs_set_rtt_compare()</code> builds an ordering hook and <code>ecs_set_rtt_equals()</code> an equality hook, both recursing into member types as needed. They also work on compile-time types that never got comparison hooks of their own — reflection knows enough to compare them field by field.</p><p>Where does this all pay off? Modding and scripting: a mod or a Flecs Script file can introduce component types the shipped binary never heard of, and they behave like first-class citizens — storable, queryable, printable, editable in the Explorer.</p>"
      }
    ],
    related: ["rfl-describing", "components", "script", "rfl-collections"]
  },
  {
    id: "rfl-units",
    parent: "reflection",
    order: 6,
    title: "Units",
    code: "RFL-06",
    tagline: "A number with a label: 10 what? Meters, seconds, percent?",
    intro: "A bare <code>10</code> in a component tells you very little — 10 meters? 10 seconds? 10 percent? The units addon lets you attach that missing label to struct members, so tools can display <code>10 m</code> or <code>50 %</code>, pick sensible widgets, and know how units relate to each other.",
    sections: [
      {
        type: "text",
        heading: "Quantities, units, prefixes",
        html: "<p>The system has three layers, and all three are — of course — entities:</p><ul><li>A <strong>quantity</strong> is the thing being measured: length, mass, duration. Quantities are entities tagged with <code>EcsQuantity</code>.</li><li>A <strong>unit</strong> is a scale for measuring a quantity: meters, miles and pixels all measure length. A unit entity has an <code>EcsUnit</code> component storing its <code>symbol</code> (like <code>&quot;m&quot;</code>), an optional <code>base</code> unit it derives from, an optional <code>over</code> unit for rates (meters <em>per second</em>), and a <code>translation</code> — a factor and power that relate it to its base, like &quot;kilometers = meters times 10 to the 3rd&quot;.</li><li>A <strong>prefix</strong> is a reusable multiplier: kilo, milli, mega, and the binary ones like kibi and mebi. Registering &quot;kilometers&quot; is as simple as &quot;meters with the kilo prefix&quot; — the symbol <code>km</code> and the factor come along automatically.</li></ul>"
      },
      {
        type: "code",
        heading: "Attaching units to members",
        lang: "c",
        title: "The unit rides along in the member description",
        src: "ECS_IMPORT(world, FlecsUnits);\n\ntypedef struct {\n  double temperature;\n  double wind_speed;\n} Weather;\n\nECS_COMPONENT(world, Weather);\n\necs_struct(world, {\n  .entity = ecs_id(Weather),\n  .members = {\n    { .name = \"temperature\", .type = ecs_id(ecs_f64_t),\n      .unit = EcsCelsius },\n    { .name = \"wind_speed\", .type = ecs_id(ecs_f64_t),\n      .unit = EcsMetersPerSecond }\n  }\n});"
      },
      {
        type: "diagram",
        heading: "How kilometers-per-hour is built",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "q", label: "Length", sub: "quantity" },
              { id: "q2", label: "Duration", sub: "quantity" } ],
            [ { id: "m", label: "Meters", sub: "unit, symbol m" },
              { id: "h", label: "Hours", sub: "unit, symbol h" } ],
            [ { id: "km", label: "KiloMeters", sub: "Meters + Kilo prefix" } ],
            [ { id: "kmh", label: "KiloMetersPerHour", sub: "base: KiloMeters, over: Hours, symbol km/h" } ]
          ],
          edges: [
            { from: "q", to: "m" },
            { from: "q2", to: "h" },
            { from: "m", to: "km", label: "prefix" },
            { from: "km", to: "kmh", label: "base" },
            { from: "h", to: "kmh", label: "over" }
          ],
          note: "Derived units chain: each link records the translation back to its base."
        }
      },
      {
        type: "text",
        heading: "What tooling does with them",
        html: "<p>Units flow everywhere reflection does. The meta cursor reports them with <code>ecs_meta_get_unit()</code>, JSON output can include the symbol, and the Explorer renders values with their symbol — <code>23.5 °C</code> instead of a naked number — and can use the quantity to group and convert related units. Because translations are recorded, tools can convert between units that share a base, like showing meters as kilometers.</p><p>Defining your own is one call each: <code>ecs_quantity_init()</code>, <code>ecs_unit_init()</code> (symbol, quantity, base, over, translation, prefix), and <code>ecs_unit_prefix_init()</code>. But you'll rarely need to — see the built-in catalog below.</p>"
      }
    ],
    related: ["rfl-units-catalog", "rfl-structs", "remote"]
  },
  {
    id: "rfl-units-catalog",
    parent: "rfl-units",
    order: 1,
    title: "The Built-in Unit Catalog",
    code: "RFL-06A",
    tagline: "Import one module and get the everyday units of science and computing",
    intro: "The units addon ships a ready-made catalog: import <code>FlecsUnits</code> and you get seventeen quantity families, dozens of units, and the full set of metric and binary prefixes — from yocto to yotta and kibi to yobi.",
    sections: [
      {
        type: "diagram",
        heading: "The quantity families",
        spec: {
          type: "grid",
          title: "Quantities defined in the FlecsUnits module",
          cols: ["Quantity", "Units include"],
          rows: [
            ["Duration", "pico/nano/micro/milliseconds, seconds, minutes, hours, days"],
            ["Time", "date"],
            ["Mass", "grams, kilograms"],
            ["Length", "pico- through kilometers, miles, pixels"],
            ["Speed", "m/s, km/s, km/h, mph"],
            ["Temperature", "kelvin, celsius, fahrenheit"],
            ["Force", "newton"],
            ["Pressure", "pascal, bar"],
            ["Electric current", "ampere"],
            ["Amount", "mole"],
            ["Luminous intensity", "candela"],
            ["Frequency", "hertz, kilo/mega/gigahertz"],
            ["Data", "bits and bytes with kilo/mega/giga and kibi/mebi/gibi"],
            ["Data rate", "bits and bytes per second, with prefixes"],
            ["Angle", "radians, degrees"],
            ["URI", "hyperlink, image, file"],
            ["Color", "rgb, hsl, css"]
          ],
          note: "Plus standalone units: acceleration, percentage, bel and decibel."
        }
      },
      {
        type: "text",
        heading: "Reading the catalog",
        html: "<p>Every entry is an entity constant you can use directly in a member description: <code>EcsSeconds</code>, <code>EcsKiloMeters</code>, <code>EcsMegaBytesPerSecond</code>, <code>EcsDegrees</code>, <code>EcsPercentage</code>. Units live in a module hierarchy, so their full names are paths like <code>units.length.KiloMeters</code>.</p><p>A few families are less about physics and more about telling tools how to <em>render</em> a value: a string member with the <code>EcsUriImage</code> unit tells the Explorer &quot;this text is an image link, show the picture&quot;, and the color units say &quot;render a color swatch&quot;. Percentage is what turns a plain float into a progress bar, especially combined with a member range.</p>"
      },
      {
        type: "code",
        heading: "Using catalog units",
        lang: "c",
        title: "A download tracked in real units",
        src: "typedef struct {\n  int64_t size;\n  double rate;\n  double progress;\n} Download;\n\nECS_COMPONENT(world, Download);\n\necs_struct(world, {\n  .entity = ecs_id(Download),\n  .members = {\n    { .name = \"size\", .type = ecs_id(ecs_i64_t), .unit = EcsBytes },\n    { .name = \"rate\", .type = ecs_id(ecs_f64_t), .unit = EcsMegaBytesPerSecond },\n    { .name = \"progress\", .type = ecs_id(ecs_f64_t), .unit = EcsPercentage,\n      .range = { 0, 100 } }\n  }\n});"
      }
    ],
    related: ["rfl-units", "observability"]
  }
]);
