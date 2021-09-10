const example_plecs = `// Transitive makes sure that (LocatedIn,Earth)
// also returns entities in NorthAmerica, 
// UnitedStates, SanFrancisco etc.
Transitive(LocatedIn)

// Final means the query engine doesn't need to
// look for entities derived from LocatedIn
Final(LocatedIn)

// Create locations with tags for different kinds
// so we can filter on it
Continent(NorthAmerica)
Continent(Europe)

Country(UnitedStates)
Country(Italy)

City(SanFrancisco)
City(Seattle)
City(Florence)

// Create location hierarchy
LocatedIn(NorthAmerica, Earth)
LocatedIn(UnitedStates, NorthAmerica)
LocatedIn(SanFrancisco, UnitedStates)
LocatedIn(Seattle, UnitedStates)

LocatedIn(Europe, Earth)
LocatedIn(Italy, Europe)
LocatedIn(Florence, Italy)

LocatedIn(Sander, SanFrancisco)
LocatedIn(Cart, Seattle)
LocatedIn(Michele, Florence)

// Who's creating what
AuthorOf(Sander, Flecs)
AuthorOf(Cart, Bevy)
AuthorOf(Michele, EnTT)
`

Vue.component('editor', {
    props: ['run_ok', 'run_error', 'run_msg'],
    methods: {
        run() {
            this.$emit('run-code', this.code);
            this.changed = false;
        },
        text_changed() {
            this.changed = true;
            this.$emit('change-code');
        }
    },
    data: function() {
        return {
            changed: true,
            code: example_plecs
        }
    },
    computed: {
        button_css: function() {
            if (this.changed && this.code && this.code.length) {
                return "editor-button-run";
            } else {
                return "editor-button-run button-disabled";
            }
        },
        msg: function() {
            return this.run_msg;
        },
        msg_css: function() {
            if (this.run_ok) {
                return "editor-msg-bar editor-ok-bar";
            } else if (this.run_error) {
                return "editor-msg-bar editor-err-bar";
            } else {
                return "editor-msg-bar";
            }
        }
    },
    template: `
      <div class="editor">
        <textarea id="plecs-editor" class="plecs-editor" v-model="code" v-on:keyup="text_changed"></textarea>
        <div :class="msg_css">{{msg}}</div>
        <button :class="button_css" v-on:click="run">Run</button>
      </div>
      `
  });
