(function () {
  var words = {
    c: {
      keyword: "auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local",
      type: "bool char double ecs_entity_t ecs_id_t ecs_iter_t ecs_query_t ecs_system_t ecs_world_t float int int16_t int32_t int64_t int8_t long ptrdiff_t short signed size_t uint16_t uint32_t uint64_t uint8_t unsigned void"
    },
    flecs: {
      keyword: "const else for if in module prefab template using with without",
      type: "bool entity f32 f64 i16 i32 i64 i8 string u16 u32 u64 u8"
    },
    json: {
      keyword: "false null true",
      type: ""
    },
    bash: {
      keyword: "case do done elif else esac export fi for function if in local readonly select then until while",
      type: ""
    }
  };

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function wordSet(value) {
    var set = {};
    value.split(" ").forEach(function (word) { if (word) set[word] = true; });
    return set;
  }

  Object.keys(words).forEach(function (lang) {
    words[lang].keyword = wordSet(words[lang].keyword);
    words[lang].type = wordSet(words[lang].type);
  });

  function pattern(lang) {
    if (lang === "bash") return /#[^\n]*|"(?:\\.|[^"\\])*"|'[^']*'|\$\{?\w+\}?|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b/g;
    if (lang === "json") return /"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\b(?:true|false|null)\b/g;
    return /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[ \t]*[A-Za-z_]\w*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:0x[\da-f]+|\d+(?:\.\d+)?f?)\b|\b[A-Za-z_]\w*\b/gim;
  }

  function tokenClass(token, lang, source, end) {
    if (token.indexOf("//") === 0 || token.indexOf("/*") === 0 || lang === "bash" && token.charAt(0) === "#") return "comment";
    if (token.charAt(0) === "#") return "directive";
    if (token.charAt(0) === '"' || token.charAt(0) === "'" || token.charAt(0) === "$") return "string";
    if (/^-?(?:0x)?[\d.]/i.test(token)) return "number";
    if (words[lang].keyword[token]) return "keyword";
    if (words[lang].type[token]) return "type";
    if (/^\s*\(/.test(source.slice(end))) return "function";
    return "";
  }

  function render(source, lang) {
    lang = words[lang] ? lang : "c";
    var output = "";
    var last = 0;
    var regex = pattern(lang);
    var match;
    while ((match = regex.exec(source))) {
      output += escapeHtml(source.slice(last, match.index));
      var cls = tokenClass(match[0], lang, source, regex.lastIndex);
      output += cls ? '<span class="tok-' + cls + '">' + escapeHtml(match[0]) + "</span>" : escapeHtml(match[0]);
      last = regex.lastIndex;
    }
    return output + escapeHtml(source.slice(last));
  }

  window.FLECS_HIGHLIGHT = { render: render };
})();
