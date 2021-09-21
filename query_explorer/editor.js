const example_plecs = `// This is Plecs, a language for quickly creating entities
// without having to run and compile C/C++ code. Changing
// the code will automatically update the viewer.

// The example creates a solar system and shows how to
// use entity hierarchies and relationships.

// This lets us query for "Planet", and still get entities
// with "DwarfPlanet", "RockyPlanet" and "GasGiant".
(IsA, Planet) {
  DwarfPlanet, RockyPlanet, GasGiant
}

// Create a Sun entity that has a Star tag. All entities
// inside { } are created as child entities of Sun.
Star(Sun) {
 // Create entities with RockyPlanet tag
 with RockyPlanet {
  Mercury, Venus, Earth, Mars 
 }

 // Create entities with GasGiant tag
 with GasGiant { 
  Jupiter, Saturn, Neptune, Uranus 
 }

 // Create entities with DwarfPlanet tag
 with DwarfPlanet { Pluto, Ceres }
}

// Add moon entities to the planet scopes
Sun.Earth {
 Satellite(Moon)

 // Create entities with Satellite & Artificial tags
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

// Add more child entities to the scope of Sun.Earth
Sun.Earth {
 with Continent { 
  Europe, Asia, Africa, NorthAmerica, SouthAmerica,
  Australia, Antartica
 }

 NorthAmerica {
  with Country { UnitedStates, Canada }

  UnitedStates {
   with City {
    SanFrancisco, LosAngeles, NewYorkCity, Seattle 
   }
  }
 }

 Europe {
  with Country { Netherlands, Germany, France, UK }
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
    },
    get_code() {
      return this.code;
    },
    set_code(code) {
      this.code = code;
      this.run();
    },
    tab_pressed (event) { }
  },
  data: function() {
    return {
      code: example_plecs
    }
  },
  computed: {
    button_css: function() {
      if (this.code != this.last_ran) {
        return "editor-button-run";
      } else {
        return "editor-button-run button-disabled";
      }
    }
  },
  template: `
    <div>
      <textarea 
          id="plecs-editor" 
          class="editor-textarea" 
          v-model="code" 
          v-on:keyup="run"
          v-on:keydown.tab.prevent="tab_pressed($event)">
      </textarea>
    </div>
    `
});
