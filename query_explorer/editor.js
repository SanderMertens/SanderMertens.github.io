const example_plecs = `// These relations enable the query engine to return
// (for example) all entities with RockyPlanet, GasGiant
// when asked for Planet.
IsA(Star, CelestialBody)
IsA(Satellite, CelestialBody)
IsA(Planet, CelestialBody)
IsA(RockyPlanet, Planet)
IsA(GasGiant, Planet)

// Create a hierarchy using the builtin ChildOf relation
Star(Sun) {
 // 'with' reduces repetition for similar entities
 with RockyPlanet {
  Mercury, Venus, Earth, Mars 
 }

 with GasGiant { 
  Jupiter, Saturn, Neptune, Uranus 
 }

 with DwarfPlanet { Pluto, Ceres }
}

// Extend the hierarchy with moons
Sun.Earth {
 Satellite(Moon)
}

Sun.Mars {
 with Satellite { Phobos, Deimos }
}

Sun.Jupiter {
 with Satellite { Europa, Io, Callisto, Ganymede }
}

Sun.Saturn {
 with Satellite { Titan, Enceladus }
}

// Add continents to Earth
Sun.Earth {
 with Continent { 
  Europe, Asia, Africa, NorthAmerica, SouthAmerica,
  Australia, Antartica
 }
}
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
