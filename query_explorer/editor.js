const example_plecs = `// Plecs editor
//
// Plecs is a simple entity definition language that
// lets us experiment with entities and queries without
// having to write & compile C/C++ code.
//

// These first statements create a basic taxonomy. This 
// enables us to, for example, query for "Planet" and 
// find entities that have RockyPlanet or GasGiant.
(IsA, CelestialBody) { 
  Star, Satellite, DwarfPlanet, Planet
}

IsA(RockyPlanet, Planet)
IsA(GasGiant, Planet)

// Create a hierarchy with the sun as root and the
// planets as children. The { } syntax uses the builtin
// ChildOf relation to create the hierarchy.
Star(Sun) {
 // A 'with' statement lets us add the same component(s)
 // to multiple entities.
 with RockyPlanet {
  Mercury, Venus, Earth, Mars 
 }

 with GasGiant { 
  Jupiter, Saturn, Neptune, Uranus 
 }

 with DwarfPlanet { Pluto, Ceres }
}

// To avoid deep indentation, we can open the scope of
// a nested entity outside of the initial hierarchy.
Sun.Earth {
 Satellite(Moon)
 with Satellite, Artificial { HubbleTelescope, ISS }
}

Sun.Mars {
 with Satellite { Phobos, Deimos }
 with Satellite, Artificial { MarsOrbiter }
}

Sun.Jupiter {
 with Satellite { Europa, Io, Callisto, Ganymede }
}

Sun.Saturn {
 with Satellite { Titan, Enceladus }
}

Sun.Pluto {
  Satellite(Charon)
}

// Add continents & countries to Earth
Sun.Earth {
 with Continent { 
  Europe, Asia, Africa, NorthAmerica, SouthAmerica,
  Australia, Antartica
 }

 with Country {
   // To prevent adding 'Country' to NorthAmerica and
   // Europe we use (), which explicitly marks them as
   // something we don't want to add anything to.
   NorthAmerica() { UnitedStates, Canada }
   Europe() { Netherlands, Germany, France, UK }
 }
}
`

Vue.component('editor', {
    props: ['run_ok', 'run_error', 'run_msg'],
    mounted: function() {
      this.ldt = new TextareaDecorator( 
        document.getElementById('plecs-editor'), syntax_highlighter );
    },
    updated: function() {
      this.ldt.update();
    },
    methods: {
        run() {
            this.$emit('run-code', this.code);
            this.changed = false;
            this.last_ran = this.code;
        },
        text_changed() {
            this.$emit('change-code');
        },
        get_code() {
            return this.code;
        },
        set_code(code) {
            this.code = code;
            this.text_changed();
        },
        tab_pressed (event) { }
    },
    data: function() {
        return {
            code: example_plecs,
            last_ran: undefined
        }
    },
    computed: {
        button_css: function() {
            if (this.code != this.last_ran) {
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
        <textarea 
            id="plecs-editor" 
            class="plecs-editor" 
            v-model="code" 
            v-on:keyup="text_changed"
            v-on:keydown.tab.prevent="tab_pressed($event)">
        </textarea>
        <div :class="msg_css">{{msg}}</div>
        <button :class="button_css" v-on:click="run">Run</button>
      </div>
      `
  });
