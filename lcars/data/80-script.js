window.FLECS_TOUR.register([
  {
    id: "scr-basics",
    parent: "script",
    order: 1,
    title: "Syntax Basics",
    code: "SCR-01",
    tagline: "Write down your world the way you would sketch it on paper",
    intro: "A Flecs script is a text file that describes entities and their data. You write a name, open curly braces, and everything inside belongs to that entity: tags, components with values, and even child entities. Think of it as a packing list for your world — Flecs reads it and builds everything on the list.",
    sections: [
      {
        type: "text",
        heading: "Entities, tags and components",
        html: "<p>The three most common statements, from simplest to richest:</p><ul><li><strong>An entity</strong> is just a name followed by braces: <code>my_entity {}</code>. Leave out the name (or use <code>_</code>) to create an anonymous entity.</li><li><strong>A tag</strong> — a label with no data — is added by writing its name inside an entity's braces.</li><li><strong>A component</strong> — a label with data — is written as <code>Name: value</code>, where the value after the colon is an expression. For a struct you use an initializer like <code>{x: 10, y: 20}</code>; for a single number you can write it directly, like <code>Mass: 100</code>.</li></ul><p>Relationship pairs work too: <code>(Likes, Pizza)</code> adds the pair, and <code>(Start, Position): {x: 0, y: 0}</code> assigns a value to a pair. For a component to be assignable from a script, Flecs must know its layout through the reflection addon — that is what the whole Reflection deck is about.</p>"
      },
      {
        type: "code",
        heading: "A small scene",
        lang: "flecs",
        title: "scene.flecs",
        src: "SpaceShip {}\nLikes {}\nPizza {}\n\nmy_ship {\n  SpaceShip\n  (Likes, Pizza)\n  Position: {x: 10, y: 20}\n  Mass: 100\n}"
      },
      {
        type: "text",
        heading: "The kind syntax",
        html: "<p>You can put a component <em>before</em> the entity name, like a type in a variable declaration: <code>SpaceShip my_ship {}</code> means the same as adding <code>SpaceShip</code> inside the braces. If the kind is a component, you can pass its value in parentheses: <code>CheckBox my_checkbox(checked: true)</code>. With the kind syntax the braces become optional, so <code>SpaceShip my_ship</code> on its own line is a complete statement.</p><p>A few more conveniences:</p><ul><li><code>prefab SpaceShip {}</code> is a builtin kind, shorthand for creating an entity with the <code>Prefab</code> tag. Instantiate it with the inheritance operator: <code>my_ship : SpaceShip {}</code>, which adds an <code>IsA</code> pair.</li><li><code>$ { TimeOfDay: {t: 0.5} }</code> uses <code>$</code> as the entity, which assigns singleton components.</li><li><code>&quot;my entity&quot; {}</code> creates an entity whose name contains spaces or other special characters.</li><li><code>SpaceShip; HasFtl</code> puts two statements on one line, and <code>pilot_a, pilot_b</code> creates two empty child entities with one comma.</li></ul>"
      },
      {
        type: "code",
        heading: "Kinds, prefabs and singletons",
        lang: "flecs",
        title: "shortcuts.flecs",
        src: "prefab SpaceShip {\n  MaxSpeed: {value: 100}\n}\n\nmy_ship : SpaceShip {\n  Position: {x: 10, y: 20}\n}\n\nCheckBox my_checkbox(checked: true)\n\n$ {\n  TimeOfDay: {t: 0.5}\n}"
      }
    ],
    related: ["scr-hierarchies", "scr-types", "components", "reflection", "lifecycle"]
  },
  {
    id: "scr-hierarchies",
    parent: "scr-basics",
    order: 1,
    title: "Hierarchies & Scopes",
    code: "SCR-01A",
    tagline: "Nest braces to nest entities",
    intro: "In a script, putting one entity inside another entity's braces makes it a child, the same way folders nest inside folders. Behind the scenes this adds a <code>ChildOf</code> relationship pair — no extra syntax needed.",
    sections: [
      {
        type: "text",
        heading: "Nesting is parenting",
        html: "<p>Every pair of braces opens a <strong>scope</strong>. Entities declared inside a scope become children of the entity that owns it. Children get their own scopes, so hierarchies of any depth read like an indented outline of your scene.</p><p>When you need to refer to something that lives elsewhere in the tree, write its full path with dots, like <code>Sun.Earth</code> — the dot is the path separator, just like <code>/</code> in file paths. To avoid typing long paths over and over, a <code>using</code> statement imports a namespace into the current scope, like a shortcut: after <code>using game.engines</code> you can write <code>FtlEngine</code> instead of <code>game.engines.FtlEngine</code>. A trailing wildcard (<code>using game.*</code>) imports everything matching the path, and a <code>module</code> statement at the top of a script puts everything the script creates inside a named module entity.</p>"
      },
      {
        type: "code",
        heading: "A nested scene",
        lang: "flecs",
        title: "hierarchy.flecs",
        src: "ship {\n  Position: {x: 0, y: 0}\n\n  cockpit {\n    Position: {x: -2, y: 0}\n\n    pilot_seat {}\n  }\n\n  cargo_hold {\n    Position: {x: 4, y: 0}\n  }\n}"
      },
      {
        type: "diagram",
        heading: "What the braces build",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "h1", label: "ship" } ],
            [ { id: "h2", label: "cockpit", sub: "(ChildOf, ship)" },
              { id: "h3", label: "cargo_hold", sub: "(ChildOf, ship)" } ],
            [ { id: "h4", label: "pilot_seat", sub: "(ChildOf, ship.cockpit)" } ]
          ],
          edges: [
            { from: "h1", to: "h2" },
            { from: "h1", to: "h3" },
            { from: "h2", to: "h4" }
          ],
          note: "Each level of nesting becomes a ChildOf pair. The full path of pilot_seat is ship.cockpit.pilot_seat."
        }
      },
      {
        type: "text",
        heading: "with statements and pair scopes",
        html: "<p>When many entities need the same components, a <code>with</code> statement saves repetition: everything declared inside <code>with SpaceShip { ... }</code> gets the <code>SpaceShip</code> tag added automatically, like a rubber stamp applied to every entity in the block. You can list multiple ids (<code>with SpaceShip, HasWeapons</code>) and even component values in parentheses (<code>with Color(38, 25, 13)</code>).</p><p>Hierarchies do not have to use <code>ChildOf</code>. Opening a scope on a relationship pair makes that pair the nesting relationship: inside <code>(IsA, Thing) { ... }</code>, every entity gets <code>(IsA, Thing)</code> instead of a parent, which is a compact way to write classification trees.</p>"
      },
      {
        type: "code",
        heading: "with and pair scopes",
        lang: "flecs",
        title: "with.flecs",
        src: "with SpaceShip, HasWeapons {\n  MillenniumFalcon {}\n  Rocinante {}\n}\n\n(IsA, Thing) {\n  (IsA, Animal) {\n    Human {}\n  }\n  (IsA, Plant) {\n    Tree {}\n  }\n}"
      }
    ],
    related: ["scr-basics", "world", "components"]
  },
  {
    id: "scr-types",
    parent: "scr-basics",
    order: 2,
    title: "Defining Types in Script",
    code: "SCR-01B",
    tagline: "Declare your components without writing a line of C",
    intro: "Scripts can define brand new component types — structs, enums and bitmasks — right in the text file. Flecs registers them with the reflection framework, so the rest of the script (and the rest of the engine) can use them immediately.",
    sections: [
      {
        type: "text",
        heading: "Structs, enums, bitmasks",
        html: "<p>Type definitions use the type entities from the <code>flecs.meta</code> module as the entity kind:</p><ul><li>A <strong>struct</strong> lists its members as <code>name: type</code> pairs. Member types can be other script-defined types, so structs can nest.</li><li>An <strong>enum</strong> lists named constants; they count up from zero unless you assign values like <code>Low: 1</code>.</li><li>A <strong>bitmask</strong> is like an enum but constants get incrementing powers of two, so they can be combined with <code>|</code>.</li></ul><p>Members are real entities: each one is a child of the struct with a <code>flecs.meta.Member</code> component. The <code>name: type</code> form is a shorthand; assign an initializer instead to set more <code>Member</code> fields, like an array count or a unit.</p>"
      },
      {
        type: "code",
        heading: "Types in a script",
        lang: "flecs",
        title: "types.flecs",
        src: "struct Position(x: f32, y: f32)\n\nstruct Line(start: Position, stop: Position)\n\nstruct Points(values: {f32, count: 3})\n\nenum Color(Red, Green, Blue)\n\nenum Prio(Low: 1, Medium: 5, High: 10)\n\nbitmask Toppings(Bacon, Lettuce, Tomato)\n\nmy_entity {\n  Position: {x: 10, y: 20}\n  Color: Red\n  Toppings: Bacon | Tomato\n}"
      },
      {
        type: "text",
        heading: "Notes and gotchas",
        html: "<p>Enum constants are stored as <code>i32</code> by default; add a configuration scope like <code>enum Color(Red, Green, Blue, {underlying_type: u64})</code> to change that. Bitmask constants are always <code>u32</code>.</p><p>Because the lvalue's type guides name resolution, you can write <code>Red</code> instead of <code>Color.Red</code> whenever you assign to something Flecs already knows is a <code>Color</code>.</p>"
      }
    ],
    related: ["scr-basics", "scr-expressions", "reflection"]
  },
  {
    id: "scr-variables",
    parent: "script",
    order: 2,
    title: "Variables",
    code: "SCR-02",
    tagline: "Name a value once, use it everywhere",
    intro: "Scripts can store values in named variables with the <code>const</code> keyword, like sticky notes you refer back to. Use a variable by prefixing its name with <code>$</code>, so <code>$wood</code> means &quot;the value on the sticky note called wood&quot;.",
    sections: [
      {
        type: "text",
        heading: "Declaring and using",
        html: "<p>A declaration is <code>const name = expression</code>. The type is inferred from the value, or you can state it explicitly: <code>const wood: Color = {38, 25, 13}</code> — the explicit type is required when the value is an initializer, because <code>{38, 25, 13}</code> alone doesn't say what it is a value <em>of</em>.</p><p>Variables appear in three places:</p><ul><li>Inside expressions and initializers: <code>Rotation: {angle: $pi / 2}</code>.</li><li>As a whole component value: <code>Color: $wood</code>.</li><li>In a <code>with</code> statement: <code>with $wood { ... }</code> stamps the component value onto every entity in the block.</li></ul><p>The <code>$</code> prefix is optional when nothing else has that name, but required to disambiguate when an entity is also called <code>pi</code>. Inside initializers there is a shorthand: <code>Tree: {color: $, height: $}</code> fills each member from the variable with the same name.</p>"
      },
      {
        type: "code",
        heading: "Variables at work",
        lang: "flecs",
        title: "vars.flecs",
        src: "const pi = 3.1415926\nconst pi_2 = $pi * 2\nconst wood: Color = {38, 25, 13}\n\nwindmill {\n  Rotation: {angle: $pi / 2}\n  Color: $wood\n}\n\nwith $wood {\n  pillar_1 {}\n  pillar_2 {}\n  pillar_3 {}\n}"
      },
      {
        type: "diagram",
        heading: "Scopes shadow their parents",
        spec: {
          type: "stack",
          layers: [
            { label: "Root scope", sub: "const pi, const wood" },
            { label: "Entity scope", sub: "sees pi and wood, can add its own" },
            { label: "Inner scope", sub: "a const named pi here shadows the outer pi" }
          ],
          note: "Lookups walk from the innermost scope outward, like asking your room, then your house, then your street."
        }
      },
      {
        type: "text",
        heading: "Exported variables and component values",
        html: "<p>Prefix a declaration with <code>export</code> and the variable becomes an entity other scripts — and your C code — can see: <code>export const pi = 3.1415926</code>. Exported variables are created as children of the scope they appear in, so one declared inside <code>math { ... }</code> is reachable as <code>math.pi</code>. From C you create one with <code>ecs_const_var(world, {...})</code> and read one with <code>ecs_const_var_get()</code>, which makes scripts a handy configuration format.</p><p>Scripts can also read component values from entities: <code>Game[Level]</code> fetches the <code>Level</code> component from the <code>Game</code> entity, and <code>const level = Game[Level]</code> stores a <em>copy</em> in a variable so you can use <code>$level.width</code> repeatedly without extra lookups. If the component does not exist, the script fails.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_script_var_t",
        summary: "One variable as the script engine sees it. Applications build these through the ecs_script_vars_* API to pass values into scripts.",
        members: [
          { name: "name", type: "const char *", desc: "The variable's name, without the $ prefix." },
          { name: "value", type: "ecs_value_t", desc: "The value: a type entity plus a pointer to the actual bytes." },
          { name: "type_info", type: "const ecs_type_info_t *", desc: "Size, alignment and lifecycle hooks for the type, so the engine knows how to copy and destroy the value." },
          { name: "sp", type: "int32_t", desc: "The variable's slot number in its scope, used to find it by position instead of by name for speed." },
          { name: "is_const", type: "bool", desc: "Whether the variable may be written to after it is set." }
        ]
      }
    ],
    related: ["scr-expressions", "scr-templates", "scr-running"]
  },
  {
    id: "scr-expressions",
    parent: "scr-variables",
    order: 1,
    title: "Expressions",
    code: "SCR-02A",
    tagline: "Little calculations anywhere a value goes",
    intro: "Everywhere a script expects a value — after a component's colon, in a variable declaration, inside a string — you can write an expression: math, comparisons, function calls, member access. Flecs evaluates it and pours the result into the value's type.",
    sections: [
      {
        type: "text",
        heading: "What you can write",
        html: "<p>Expressions support the operators you know from calculators and C: arithmetic (<code>+ - * / %</code>), comparisons (<code>== != &lt; &lt;= &gt; &gt;=</code>), logic (<code>! &amp;&amp; ||</code>), bit operations (<code>&amp; | &lt;&lt; &gt;&gt;</code>), and parentheses to group. Values can be numbers, strings, entities, enum constants, initializers like <code>{x: 10, y: 20}</code>, and collections like <code>[1, 2, 3]</code>.</p><p>Every expression has a type, worked out from its operands and from the <strong>lvalue</strong> — the thing being assigned to. Assign to a <code>Position</code> and your initializer becomes a <code>Position</code>; assign <code>Red</code> to a <code>Color</code> and the name resolves inside the <code>Color</code> enum. Integer literals are <code>i64</code>, decimals are <code>f64</code>, and mixed-type math picks the most expressive type that loses no precision.</p><p>Some special forms:</p><ul><li><strong>Member access</strong>: <code>$level.width</code> reads one field of a composite value; <code>e.parent().name()</code> chains method calls.</li><li><strong>match</strong>: picks a value by case, like a multiple-choice question — <code>match x { 1: 10, 2: 20, _: 100 }</code> (the <code>_</code> case catches everything else).</li><li><strong>new</strong>: creates an entity inside an expression and evaluates to it, so anonymous entities can be stored in variables or assigned to entity-typed members.</li><li><strong>Update operators</strong>: inside initializers, <code>{y += 10}</code> modifies the existing value instead of replacing it.</li><li><strong>Vectors and swizzles</strong>: if a struct's members are all the same primitive type, operators work member-wise (<code>p + 1</code> adds 1 to x, y and z), and <code>p.zyx</code> reorders members into a new value.</li></ul>"
      },
      {
        type: "code",
        heading: "Expressions in the wild",
        lang: "flecs",
        title: "expr.flecs",
        src: "const x = 10 + 20 * 30\nconst y = pow($x, 2)\nconst p: Position = {10, 20, 30}\nconst q = $p + 1\n\nconst state = 2\n\ntraffic_light {\n  Color: match $state {\n    0: {0, 255, 0}\n    1: {255, 128, 0}\n    _: {255, 0, 0}\n  }\n}\n\nconst red = new {\n  Color: {255, 0, 0}\n}\n\ne {\n  Position: {10, 0}\n  Position: {y += 5}\n  Velocity: $p.zyx\n}"
      },
      {
        type: "text",
        heading: "String interpolation",
        html: "<p>Strings can embed values, like fill-in-the-blank sentences. <code>&quot;Hello $name&quot;</code> inserts a variable; <code>&quot;area is {$w * $h}&quot;</code> evaluates a whole expression between braces. Escape with a backslash (<code>\\$</code>, <code>\\{</code>) to keep the literal character. Interpolated floating point values accept a format specifier after a colon, such as <code>&quot;{value:.2}&quot;</code> for two decimals, with padding, alignment, sign and scientific-notation options. Interpolation even works in entity names, so <code>&quot;e_$i&quot;</code> in a loop names each entity differently.</p>"
      },
      {
        type: "code",
        heading: "Interpolation",
        lang: "flecs",
        title: "strings.flecs",
        src: "const r = 2.0\nconst circumference = \"circle is {2 * $PI * $r:.2} units around\"\n\nfor i in 0..3 {\n  \"turret_$i\" {\n    Position: {x: $i * 10}\n  }\n}"
      },
      {
        type: "text",
        heading: "Expressions from C",
        html: "<p>The expression engine is usable on its own, without a full script. <code>ecs_expr_run()</code> evaluates an expression string straight into a value; <code>ecs_expr_parse()</code> plus <code>ecs_expr_eval()</code> let you parse once and evaluate many times, with an <code>ecs_expr_eval_desc_t</code> to supply variables, expected type and performance options. <code>ecs_script_string_interpolate()</code> does the fill-in-the-blank trick on any C string. This is the same machinery the REST API uses to let the Explorer evaluate expressions against a live world.</p>"
      }
    ],
    related: ["scr-variables", "scr-functions", "scr-expr-engine", "remote"]
  },
  {
    id: "scr-functions",
    parent: "scr-variables",
    order: 2,
    title: "Functions & Methods",
    code: "SCR-02B",
    tagline: "Call helpers from inside your expressions",
    intro: "Expressions can call functions, like <code>sqrt(100)</code>, and methods, like <code>v.length()</code> — a method is just a function called on a value, where that value is passed in as the first argument. Flecs ships builtin functions, a math library, and lets you register your own from C or define them in the script itself.",
    sections: [
      {
        type: "text",
        heading: "What's built in",
        html: "<p>Three groups come with Flecs:</p><ul><li><strong>Core</strong> (<code>flecs.script.core</code>): the <code>pair(a, b)</code> function builds a pair id, and every entity value has methods <code>name()</code>, <code>path()</code>, <code>parent()</code> and <code>has(id)</code>. With the doc addon compiled in, entities also get <code>doc_name()</code>, <code>doc_brief()</code>, <code>doc_color()</code> and friends for reading attached documentation.</li><li><strong>Math</strong> (<code>flecs.script.math</code>): trigonometry, logarithms, <code>pow</code>, <code>sqrt</code>, rounding, <code>min</code>/<code>max</code>/<code>clamp</code>, vector helpers like <code>lerp</code>, <code>dot</code>, <code>length</code> and <code>normalize</code>, 2D perlin noise, the constants <code>PI</code> and <code>E</code>, and an <code>Rng</code> type with <code>u(max)</code> and <code>f(max)</code> methods for random numbers. This lives in the separate <code>FLECS_SCRIPT_MATH</code> addon (off by default): compile it in and <code>ECS_IMPORT(world, FlecsScriptMath)</code>.</li><li><strong>Platform</strong> (<code>flecs.script.platform</code>, also opt-in): constants like <code>os</code>, <code>compiler</code> and booleans like <code>WINDOWS</code> or <code>LINUX</code>, so scripts can load different assets per platform.</li></ul>"
      },
      {
        type: "code",
        heading: "Defining functions in a script",
        lang: "flecs",
        title: "fn.flecs",
        src: "fn add(a: i32, b: i32) -> i32 {\n    a + b\n}\n\nfn factorial(n: i32) -> i32 {\n    match n {\n        0: 1\n        _: factorial(n - 1) * n\n    }\n}\n\nFoo {\n  Position: {add(1, 2), factorial(4)}\n}"
      },
      {
        type: "text",
        heading: "Script functions vs C functions",
        html: "<p>The <code>fn</code> keyword defines a function in script: typed parameters, a return type after <code>-&gt;</code>, and a body whose last expression is the return value. Bodies may only contain <code>const</code> variables and expressions — no <code>if</code> or <code>for</code> — so conditional logic uses <code>match</code>, including recursion as in the factorial example.</p><p>From C you register a function with <code>ecs_function()</code> and a method with <code>ecs_method()</code>; for methods, <code>parent</code> is the type the method attaches to, and the instance arrives as the first argument. A special parameter type, <code>EcsScriptVectorType</code>, makes a function generic over any vector-like struct: you provide one callback per primitive element type in <code>vector_callbacks</code>, and Flecs dispatches based on the argument's member type — that is how one <code>lerp</code> works for colors and positions alike.</p>"
      },
      {
        type: "code",
        heading: "Registering a function from C",
        lang: "c",
        title: "sum.c",
        src: "void sum(const ecs_function_ctx_t *ctx, int32_t argc,\n    const ecs_value_t *argv, ecs_value_t *result)\n{\n    int64_t *a = argv[0].ptr;\n    int64_t *b = argv[1].ptr;\n    *(int64_t*)result->ptr = *a + *b;\n}\n\necs_function(world, {\n    .name = \"sum\",\n    .return_type = ecs_id(ecs_i64_t),\n    .params = {\n        { .name = \"a\", .type = ecs_id(ecs_i64_t) },\n        { .name = \"b\", .type = ecs_id(ecs_i64_t) }\n    },\n    .callback = sum\n});"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_function_desc_t",
        summary: "What you fill in for ecs_function() or ecs_method(). Functions become entities with an EcsScriptFunction (or EcsScriptMethod) component.",
        members: [
          { name: "name", type: "const char *", desc: "The name scripts call the function by." },
          { name: "parent", type: "ecs_entity_t", desc: "Namespace parent for functions; for methods, the type the method is called on." },
          { name: "params", type: "ecs_script_parameter_t[16]", desc: "Up to 16 parameters, each a name plus a type entity." },
          { name: "return_type", type: "ecs_entity_t", desc: "The type of the value the function produces. Every function must return one." },
          { name: "callback", type: "ecs_function_callback_t", desc: "Your C function. It receives the arguments as an array of typed values and writes into a result value." },
          { name: "vector_callbacks", type: "ecs_vector_function_callback_t[18]", desc: "Per-primitive-type implementations for functions that take EcsScriptVectorType parameters; indexed by primitive kind like EcsF32." },
          { name: "ctx", type: "void *", desc: "A pointer of your choosing, handed back to the callback through ecs_function_ctx_t." }
        ]
      }
    ],
    related: ["scr-expressions", "scr-variables", "observability"]
  },
  {
    id: "scr-control-flow",
    parent: "script",
    order: 3,
    title: "If & For",
    code: "SCR-03",
    tagline: "Scripts that decide and repeat",
    intro: "Scripts are not just static lists: an <code>if</code> statement includes or skips part of a script depending on a condition, and a <code>for</code> loop repeats a part many times. Together they turn a scene description into a small program that builds scenes.",
    sections: [
      {
        type: "text",
        heading: "Conditional parts",
        html: "<p>An <code>if</code> statement takes a boolean expression and a scope, with optional <code>else if</code> and <code>else</code> branches. Whichever branch wins is evaluated as if it were written in place; the others are skipped entirely. This is how one script can describe both the day and night version of a scene, or load different content per platform using the platform constants.</p>"
      },
      {
        type: "code",
        heading: "if / else",
        lang: "flecs",
        title: "lantern.flecs",
        src: "const daytime: bool = false\n\nlantern {\n  Color: {210, 255, 200}\n\n  if $daytime {\n    Emissive: {value: 0}\n  } else {\n    Emissive: {value: 1}\n  }\n}"
      },
      {
        type: "text",
        heading: "Loops",
        html: "<p>A <code>for</code> loop iterates a range: <code>for i in 0..10</code> runs the body ten times with <code>$i</code> going from 0 to 9. Either end of the range can be an expression, like <code>0..$count</code>.</p><p>One gotcha: entity names are unique, so a loop body that declares <code>e { ... }</code> just rewrites the <em>same</em> entity ten times. Either create anonymous entities with <code>_ { ... }</code>, or bake the loop variable into the name with interpolation: <code>&quot;e_$i&quot; { ... }</code> creates <code>e_0</code> through <code>e_9</code>.</p>"
      },
      {
        type: "code",
        heading: "for",
        lang: "flecs",
        title: "streetlights.flecs",
        src: "for i in 0..10 {\n  \"lantern_$i\" {\n    Position: {x: $i * 5}\n  }\n}\n\nfor i in 0..$count {\n  _ {\n    Position: {x: $i * 5}\n  }\n}"
      }
    ],
    related: ["scr-expressions", "scr-templates", "scr-variables"]
  },
  {
    id: "scr-templates",
    parent: "script",
    order: 4,
    title: "Templates",
    code: "SCR-04",
    tagline: "A recipe you stamp onto entities, with knobs to turn",
    intro: "A template is a chunk of script that does not run right away. Instead it becomes a reusable recipe: add the template to an entity like a component, and the recipe runs <em>for that entity</em> — creating its components and children. Parameters called <em>props</em> are the knobs on the recipe.",
    sections: [
      {
        type: "text",
        heading: "Define once, instantiate anywhere",
        html: "<p>Declare a template with the <code>template</code> keyword. Its body can contain anything a script can: components, children, variables, loops, even nested template instances. The body is <em>stored</em>, not executed — it runs each time the template is <strong>instantiated</strong>, which happens when you add the template to an entity like any other component, most often with the kind syntax: <code>Tree my_tree</code>.</p><p>This is what makes templates <em>procedural</em> assets: a template with a loop inside can build a whole forest of children from one number. Inside the body, a <code>this</code> variable refers to the entity being instantiated.</p><p>Templates differ from prefabs (see the Prefabs &amp; Lifecycle deck): a prefab shares components with instances through inheritance, while a template <em>runs a script</em> per instance, so every instance gets its own freshly computed components and children.</p>"
      },
      {
        type: "code",
        heading: "A parameterized tree",
        lang: "flecs",
        title: "tree.flecs",
        src: "template Tree {\n  prop height = 10\n\n  const wood: Color = {38, 25, 13}\n  const leaves: Color = {51, 76, 38}\n  const canopy_height = 2\n  const trunk_height = $height - $canopy_height\n\n  Trunk {\n    Position: {0, ($height / 2), 0}\n    Rectangle: {2, $trunk_height}\n    Color: $wood\n  }\n\n  Canopy {\n    Position: {0, $trunk_height + ($canopy_height / 2), 0}\n    Color: $leaves\n  }\n}\n\nTree small_tree(height: 5)\nTree big_tree(height: 20)\n\nplain_tree {\n  Tree\n}"
      },
      {
        type: "diagram",
        heading: "From recipe to entities",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "tp1", label: "template Tree", sub: "body stored, props become a struct type" } ],
            [ { id: "tp2", label: "Tree small_tree(height: 5)", sub: "adds Tree component" } ],
            [ { id: "tp3", label: "on set hook", sub: "runs the stored body" } ],
            [ { id: "tp4", label: "small_tree", sub: "Trunk + Canopy children" } ]
          ],
          edges: [
            { from: "tp1", to: "tp2", label: "instantiate" },
            { from: "tp2", to: "tp3" },
            { from: "tp3", to: "tp4", label: "creates" }
          ],
          note: "Setting the Tree component again with a new height re-runs the body and updates the children."
        }
      },
      {
        type: "text",
        heading: "Live updates",
        html: "<p>Templates stay connected to their instances:</p><ul><li><strong>Change a prop</strong> — set the template component with a new value — and that instance's body re-runs with the new value.</li><li><strong>Change the template itself</strong> (redefine it, for example by hot-reloading the script that declares it) and Flecs walks every entity that has the template component and re-instantiates each one with its existing prop values.</li><li>If the template body reads component values from other entities (like <code>Game[Level]</code>), Flecs creates observers on those components, so instances also refresh when the data they depend on changes.</li></ul><p>Entities a template creates under an instance are tagged with an <code>EcsScriptTemplate</code> pair, so re-instantiating knows exactly which children it owns and may replace. One caution: templates added to prefabs are not instantiated on the prefab itself — the recipe runs when the prefab is instantiated into a real entity.</p>"
      }
    ],
    related: ["scr-template-props", "scr-managed", "lifecycle"]
  },
  {
    id: "scr-template-props",
    parent: "scr-templates",
    order: 1,
    title: "Props, Muts & the Template Component",
    code: "SCR-04A",
    tagline: "The knobs on the recipe are a real component",
    intro: "When you declare props in a template, Flecs quietly builds a real struct component named after the template, with one member per prop. The template <em>is</em> its parameter component — which is why instances are configured with plain component values, show up in the Explorer, and can be edited live.",
    sections: [
      {
        type: "text",
        heading: "prop and mut",
        html: "<p>Two keywords declare template variables that live on the instance:</p><ul><li><code>prop</code> declares a parameter. Like <code>const</code>, it takes an explicit type or infers one from its default value: <code>prop height = 10</code>, <code>prop color: Color = {255, 0, 0}</code>. All props together become the members of the template's struct type, and defaults are applied by the component's constructor.</li><li><code>mut</code> declares mutable per-instance state that is not a parameter — think of a button's <code>hover</code> flag. Muts land on a separate companion component named <code>mut</code> in the template's scope (so for <code>template Button</code>, the component is <code>Button.mut</code>).</li></ul><p>Props and muts must be declared before any <code>const</code> variables in the template body. Regular <code>const</code> variables remain internal — they are recomputed on each instantiation and never appear on the instance.</p>"
      },
      {
        type: "code",
        heading: "Props are just component values",
        lang: "flecs",
        title: "square.flecs",
        src: "template Square {\n  prop size = 10\n  prop color: Color = {255, 0, 0}\n\n  Color: $color\n  Rectangle: {width: $size, height: $size}\n}\n\nSquare my_square(size: 20, color: {38, 25, 13})\n\nother_square {\n  Square: {size: 15}\n}"
      },
      {
        type: "diagram",
        heading: "What one instance looks like in storage",
        spec: {
          type: "grid",
          title: "my_square and the children the template made",
          cols: ["Entity", "Square", "Color", "Rectangle"],
          rows: [
            ["my_square", "{size: 20, color: ...}", "38, 25, 13", "20 x 20"]
          ],
          note: "The Square component holds the prop values; Color and Rectangle were written by the template body when it ran."
        }
      },
      {
        type: "text",
        heading: "How the machinery hangs together",
        html: "<p>The template entity carries an <code>EcsScript</code> component whose <code>template_</code> field points at the stored recipe: the body's syntax tree, the prop and mut defaults, hoisted variables, and the list of <code>using</code> namespaces in effect where the template was declared. An <em>on set</em> hook on the template component triggers instantiation, so <code>ecs_set(world, e, Square, {...})</code> from C works exactly like script syntax. Because the recipe lives inside the script object, a script that defined templates is kept alive until the last template entity is deleted.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "EcsScript",
        summary: "The component on script and template entities. For templates, template_ points at the stored recipe.",
        members: [
          { name: "filename", type: "char *", desc: "Where the code came from, if it was loaded from a file." },
          { name: "code", type: "char *", desc: "The script source text." },
          { name: "error", type: "char *", desc: "The error message from the last evaluation, or empty if it succeeded." },
          { name: "script", type: "ecs_script_t *", desc: "The parsed script object: the syntax tree ready to be evaluated again." },
          { name: "template_", type: "ecs_script_template_t *", desc: "Only set on template entities: the stored body, prop and mut declarations, and defaults." },
          { name: "observers", type: "ecs_vec_t", desc: "Observers watching components the script reads from other entities, so it can re-run when they change." }
        ]
      }
    ],
    related: ["scr-templates", "scr-managed", "reflection"]
  },
  {
    id: "scr-running",
    parent: "script",
    order: 5,
    title: "Running Scripts",
    code: "SCR-05",
    tagline: "Three ways to go from text to entities",
    intro: "You can run a script once and forget it, parse it once and run it many times, or hand it to Flecs to manage — where the script becomes an entity and the world stays in sync with the text. This page covers the first two; managed scripts get their own page.",
    sections: [
      {
        type: "text",
        heading: "Run once",
        html: "<p><code>ecs_script_run(world, name, code, result)</code> parses and evaluates a string in one go; <code>ecs_script_run_file()</code> does the same for a file. The name is only used in error messages, so pass the filename or module name. Both return non-zero on failure, and the optional <code>ecs_script_eval_result_t</code> out-parameter captures the error message with line and column.</p><p>Two things to know: if a script fails partway, entities it already created are <em>not</em> automatically deleted; and if it defined templates, the script's resources stay alive until the template entities are deleted.</p>"
      },
      {
        type: "code",
        heading: "Run once, or parse once and evaluate many times",
        lang: "c",
        title: "run.c",
        src: "const char *code = \"my_spaceship {}\";\n\nif (ecs_script_run(world, \"my_script\", code, NULL)) {\n}\n\nif (ecs_script_run_file(world, \"scene.flecs\")) {\n}\n\necs_script_t *script = ecs_script_parse(\n    world, \"my_script\", code, NULL, NULL);\nif (script) {\n    ecs_script_eval(script, NULL, NULL);\n    ecs_script_eval(script, NULL, NULL);\n    ecs_script_free(script);\n}"
      },
      {
        type: "text",
        heading: "Passing variables in, reusing runtimes",
        html: "<p><code>ecs_script_parse()</code> and <code>ecs_script_eval()</code> take an <code>ecs_script_eval_desc_t</code> with two useful fields:</p><ul><li><code>vars</code>: an <code>ecs_script_vars_t</code> scope you build with <code>ecs_script_vars_init()</code> / <code>ecs_script_vars_define()</code>. The script sees each variable as <code>$name</code>, which is how C code parameterizes a script — the same scope shape systems use when they turn iterator fields into <code>$1</code>-style variables with <code>ecs_script_vars_from_iter()</code>.</li><li><code>runtime</code>: a reusable <code>ecs_script_runtime_t</code> from <code>ecs_script_runtime_new()</code>. By default every run creates scratch space on the spot; reusing a runtime across many evaluations avoids that cost. Use one runtime per thread.</li></ul><p>For debugging, <code>ecs_script_ast_to_str()</code> prints the parsed syntax tree of any script.</p>"
      },
      {
        type: "diagram",
        heading: "Choosing an API",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "r1", label: "Run once", sub: "ecs_script_run(_file)" } ],
            [ { id: "r2", label: "Parse + eval", sub: "ecs_script_parse / eval / free" } ],
            [ { id: "r3", label: "Managed", sub: "ecs_script(world, {...})" } ]
          ],
          edges: [
            { from: "r1", to: "r2", label: "need to re-run?" },
            { from: "r2", to: "r3", label: "need sync + hot reload?" }
          ],
          note: "Each step up trades a little setup for more control over the script's lifetime."
        }
      }
    ],
    related: ["scr-managed", "scr-variables", "scr-internals"]
  },
  {
    id: "scr-managed",
    parent: "scr-running",
    order: 1,
    title: "Managed Scripts & Hot Reload",
    code: "SCR-05A",
    tagline: "Edit the text, watch the world follow",
    intro: "A managed script is a script that lives in the world as an entity. Flecs remembers which entities the script created, so when you update the text, the world updates to match — new things appear, changed things change, and things you deleted from the script disappear. This is the hot-reload workflow.",
    sections: [
      {
        type: "text",
        heading: "Creating and updating",
        html: "<p><code>ecs_script(world, { .code = ... })</code> (or <code>.filename</code>) creates a script entity carrying an <code>EcsScript</code> component and evaluates it. Every entity the script creates is tagged with a pair that points back at the script entity — like a museum putting its own sticker on every piece in its collection.</p><p>To reload, call <code>ecs_script_update(world, script, 0, new_code)</code>. Flecs then:</p><ul><li>parses the new code (on a parse error, the old entities are left untouched and the error is stored in <code>EcsScript::error</code>),</li><li>clears the previously tagged entities,</li><li>evaluates the new code, tagging the new set.</li></ul><p>Named entities that appear in both versions are simply recreated under the same names, so to the rest of the world they persist; entities that no longer appear are gone. If evaluation fails midway, everything the failed run created is deleted, so a broken save never leaves half a scene behind. <code>ecs_script_clear()</code> removes a script's entities without deleting the script itself.</p>"
      },
      {
        type: "code",
        heading: "Hot reload from C",
        lang: "c",
        title: "reload.c",
        src: "ecs_entity_t s = ecs_script(world, {\n    .code = \"ship { Position: {10, 20} }\"\n});\n\nif (ecs_script_update(world, s, 0,\n    \"ship { Position: {30, 40} }\\nbuoy {}\"))\n{\n}\n\necs_script_clear(world, s, 0);"
      },
      {
        type: "diagram",
        heading: "The update cycle",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "m1", label: "New code", sub: "ecs_script_update" } ],
            [ { id: "m2", label: "Parse", sub: "fail: keep old entities, store error" } ],
            [ { id: "m3", label: "Clear old set", sub: "delete entities tagged with the script" } ],
            [ { id: "m4", label: "Evaluate", sub: "tag everything created" } ],
            [ { id: "m5", label: "World matches text", sub: "removed entities are gone" } ]
          ],
          edges: [
            { from: "m1", to: "m2" },
            { from: "m2", to: "m3", label: "parse ok" },
            { from: "m3", to: "m4" },
            { from: "m4", to: "m5" }
          ],
          note: "On an evaluation error the freshly created entities are deleted, so a bad reload cannot leave a half-built scene."
        }
      },
      {
        type: "text",
        heading: "Reactive scripts",
        html: "<p>Managed scripts that read component values from other entities (the <code>Game[Level]</code> form) register observers on those components. When such a value changes, the script re-runs automatically — so a script that lays out a grid from a <code>Level</code> component rebuilds the grid the moment the level data is set. This is the same trick templates use to keep instances fresh, and it is what makes the Explorer's live script editing feel instant: the Explorer just calls <code>ecs_script_update()</code> over the REST API. Managed scripts are marked experimental in the API, and scripts that define templates keep their resources alive until the template entities are deleted.</p>"
      },
      {
        type: "struct",
        heading: "The datatype",
        name: "ecs_script_desc_t",
        summary: "What you fill in for ecs_script_init(), usually through the ecs_script() shorthand.",
        members: [
          { name: "entity", type: "ecs_entity_t", desc: "Optional: an existing entity to attach the script to. Leave at 0 and Flecs creates one, named after the filename if there is one." },
          { name: "filename", type: "const char *", desc: "Set this to load the code from a file on disk." },
          { name: "code", type: "const char *", desc: "Set this to pass the code directly as a string. Set either this or filename." }
        ]
      }
    ],
    related: ["scr-running", "scr-templates", "remote", "events"]
  },
  {
    id: "scr-internals",
    parent: "script",
    order: 6,
    title: "How It Works Inside",
    code: "SCR-06",
    tagline: "From characters to entities in three passes",
    intro: "When Flecs reads a script it works like a person reading a recipe: first it splits the text into words (tokens), then it arranges the words into an outline of instructions (the syntax tree), then it walks the outline and actually cooks — creating entities and writing component values into the world.",
    sections: [
      {
        type: "diagram",
        heading: "The pipeline",
        spec: {
          type: "flow",
          lanes: [
            [ { id: "i1", label: "Script text", sub: "\"ship { Position: ... }\"" } ],
            [ { id: "i2", label: "Tokenizer", sub: "shared parser addon" } ],
            [ { id: "i3", label: "Parser", sub: "builds the AST" } ],
            [ { id: "i4", label: "Eval visitor", sub: "walks the tree" } ],
            [ { id: "i5", label: "The world", sub: "entities, components, values" } ]
          ],
          edges: [
            { from: "i1", to: "i2", label: "characters" },
            { from: "i2", to: "i3", label: "tokens" },
            { from: "i3", to: "i4", label: "tree" },
            { from: "i4", to: "i5", label: "ecs_add / ecs_set" }
          ],
          note: "ecs_script_parse covers the first three stages; ecs_script_eval is the last one, and can re-run on the same tree."
        }
      },
      {
        type: "text",
        heading: "Tokenize, parse, evaluate",
        html: "<p>The <strong>tokenizer</strong> (in the shared parser addon, <code>src/addons/parser</code>) chops the text into tokens: identifiers, numbers, strings, keywords like <code>template</code> and <code>with</code>, and punctuation like <code>{</code>, <code>:</code> and <code>(</code>. The <strong>parser</strong> (<code>src/addons/script/parser.c</code>) consumes tokens and builds an <strong>abstract syntax tree</strong> (AST) — an outline where each node is one statement. There are node kinds for each thing you can write: entity, tag, component, with, using, if, for, template, prop, const, function and so on. The tree of scopes mirrors your braces exactly.</p><p><strong>Evaluation</strong> (<code>src/addons/script/visit_eval.c</code>) is a <em>visitor</em>: a walker that goes through the tree top to bottom with a little backpack of state — the current parent entity, the active <code>with</code> components, the <code>using</code> namespaces, and the variable scope stack. An entity node creates or finds the entity and descends into its scope; a component node evaluates its expression and sets the value; an if node evaluates its condition and only visits the winning branch; a for node visits its body once per iteration. A separate check visitor (<code>visit_check.c</code>) validates the tree, and a to-string visitor prints it — that is what <code>ecs_script_ast_to_str()</code> uses.</p><p>Two consequences worth knowing: a parsed script can be evaluated many times without re-parsing, and a <strong>template</strong> node is <em>not</em> evaluated in place — its subtree is stored away and only visited when an instance is created, once per instantiation.</p>"
      },
      {
        type: "text",
        heading: "Writing values with the meta cursor",
        html: "<p>How does text like <code>{x: 10, y: 20}</code> become bytes inside a C struct? Through the reflection addon's <strong>meta cursor</strong>: a little write head that knows a type's layout and can be told &quot;enter the struct, move to member x, write 10&quot;. The eval visitor evaluates each expression, then drives a cursor over the component's memory to store the result, converting types where needed. This is why script assignment works for any type described in the reflection framework, and fails for types that are not — the cursor simply has no map of them.</p>"
      },
      {
        type: "text",
        heading: "Errors and the runtime",
        html: "<p>Both parse and eval errors carry the script name, line and column, and can be captured in an <code>ecs_script_eval_result_t</code> instead of being logged. Scratch memory for evaluation — token buffers, variable storage, the visitor's stacks — lives in an <code>ecs_script_runtime_t</code>, created on demand or reused across runs for speed.</p>"
      }
    ],
    related: ["scr-expr-engine", "scr-query-dsl", "reflection", "internals"]
  },
  {
    id: "scr-expr-engine",
    parent: "scr-internals",
    order: 1,
    title: "The Expression Engine",
    code: "SCR-06A",
    tagline: "Every formula gets its own tiny compiler",
    intro: "Expressions like <code>2 * $PI * $r</code> have their own mini pipeline inside the script engine: they are parsed into their own little tree, given types, pre-computed where possible, and only then evaluated. It is a scale model of what a real compiler does.",
    sections: [
      {
        type: "diagram",
        heading: "Four passes over one formula",
        spec: {
          type: "stack",
          layers: [
            { label: "Parse", sub: "expr/parser.c — text to expression tree" },
            { label: "Type visit", sub: "visit_type.c — every node gets a type, casts inserted" },
            { label: "Fold visit", sub: "visit_fold.c — constant parts computed once, tree shrinks" },
            { label: "Eval visit", sub: "visit_eval.c — compute the value with variables filled in" }
          ],
          note: "The first three passes happen at parse time; only the last one repeats on every evaluation."
        }
      },
      {
        type: "text",
        heading: "Why the extra passes",
        html: "<p>The <strong>type visitor</strong> works out the type of every node using the rules from the Expressions page — literal types, operand promotion, and the lvalue's type flowing into initializers. Getting types settled up front means evaluation never has to guess, and type errors surface at parse time with a line number instead of mid-frame.</p><p>The <strong>fold visitor</strong> is the optimizer: any subtree whose value cannot change — like <code>10 + 20 * 30</code>, or <code>2 * $PI</code> where <code>PI</code> is a const — is computed once and replaced by its result. A script evaluated every reload only pays for the parts that actually vary. (The <code>disable_folding</code> flag in <code>ecs_expr_eval_desc_t</code> trades this away for faster parsing.)</p><p>The <strong>eval visitor</strong> then walks what is left: it reads variables from the scope stack (by name, or by slot number when <code>disable_dynamic_variable_binding</code> is set), calls functions and methods through their <code>EcsScriptFunction</code> components, and produces one typed value that the script engine stores through the meta cursor.</p>"
      },
      {
        type: "text",
        heading: "The same engine, everywhere",
        html: "<p>This pipeline is not exclusive to scripts. <code>ecs_expr_run()</code> gives C code one-shot evaluation, <code>ecs_expr_parse()</code> / <code>ecs_expr_eval()</code> give it the parse-once-run-many split, and the REST API exposes it so the Explorer can evaluate expressions against your live world. String interpolation is the same engine again, run on the pieces between <code>$</code> and <code>{}</code> markers.</p>"
      }
    ],
    related: ["scr-expressions", "scr-internals", "remote"]
  },
  {
    id: "scr-query-dsl",
    parent: "scr-internals",
    order: 2,
    title: "One Parser, Two Languages",
    code: "SCR-06B",
    tagline: "Script and the query language are cousins who share a mouth",
    intro: "Flecs has two text languages: the script language you have been reading about, and the query language used in strings like <code>&quot;Position, !Frozen&quot;</code>. They are different languages — but they share one tokenizer and grammar, which is why they look and feel like family.",
    sections: [
      {
        type: "text",
        heading: "The shared layer",
        html: "<p>The <code>FLECS_PARSER</code> addon (<code>src/addons/parser</code>) holds the shared plumbing: the tokenizer that splits text into tokens, the grammar tables with every keyword and operator, and the parser state that tracks position for error messages. On top of it sit two consumers:</p><ul><li>the <strong>script parser</strong> (<code>src/addons/script/parser.c</code>), which builds statement trees out of the tokens, and</li><li>the <strong>query DSL parser</strong> (<code>src/addons/query_dsl</code>), which turns a query string into the <code>ecs_term_t</code> array of an <code>ecs_query_desc_t</code> — the same terms you could have filled in from C by hand.</li></ul><p>DSL is short for <em>domain-specific language</em>: a small language built for one job, the way sheet music is a language just for melodies.</p>"
      },
      {
        type: "diagram",
        heading: "Two languages, one foundation",
        spec: {
          type: "stack",
          layers: [
            { label: "Script parser", sub: "statements: entities, scopes, templates" },
            { label: "Query DSL parser", sub: "terms: Position, (Likes, $friend), !Frozen" },
            { label: "Shared tokenizer & grammar", sub: "src/addons/parser — FLECS_PARSER addon" }
          ],
          note: "Both top layers consume the same token stream; they just build different things from it."
        }
      },
      {
        type: "text",
        heading: "Why sharing matters",
        html: "<p>Because the token layer is shared, the two languages agree on the basics: paths use dots (<code>game.Ship</code>), pairs use parentheses (<code>(Likes, Pizza)</code>), variables use <code>$</code>, strings and numbers are written the same way. Learn one and the other reads naturally — a pair you add in a script is written exactly like the pair you match in a query. It also means one implementation of the fiddly parts (string escapes, number formats, error positions) serves both, and both are compiled out together when the parser addon is disabled.</p><p>Where queries go from here — terms, operators, and the virtual machine that evaluates them — is the Queries deck.</p>"
      }
    ],
    related: ["scr-internals", "queries", "internals"]
  }
]);
