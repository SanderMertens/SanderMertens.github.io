
Vue.config.devtools = true;

const example_query = "(ChildOf, my_spaceship)"

const example_plecs = `/// Module for organizing game assets
Module(assets) {
  // flecs.meta enables type creation at runtime
  using flecs.meta

  Struct(Position) {
    x = {f32}
    y = {f32}
  }

  Property : f32
  Health : Property
  Attack : Property

  Prefab(Turret) {
    (Health){15}
  }

  Prefab(SpaceShip) {
    (Health){75}
  }

  Prefab(BattleShip) : SpaceShip {
    (Attack){50}
    
    Prefab(LeftTurret) : Turret
    Prefab(RightTurret) : Turret
  }
}

using assets

/// A spaceship to play around with
my_spaceship : BattleShip {
  (Position){10, 20}
}

`

const example_selected = "my_spaceship";

function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return undefined;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

var app = new Vue({
  el: '#app',

  methods: {
    ready() {
      const q_encoded = getParameterByName("q");
      const p_encoded = getParameterByName("p");
      const selected = getParameterByName("s");

      if (q_encoded != undefined) {
        const q = wq_decode(q_encoded);
        this.$refs.query.set_query(q);
      } else {
        this.$refs.query.set_query(example_query);
      }

      if (p_encoded != undefined) {
        const p = wq_decode(p_encoded);
        this.$refs.plecs.set_code(p);

        if (selected) {
          this.$refs.tree.select(selected);
        }
      } else {
        this.$refs.plecs.set_code(example_plecs);
        this.$refs.tree.select(example_selected);
      }

      this.$refs.plecs.run();
      this.$refs.tree.update();
    },

    query_on_changed(e) {
      const query = e.query;

      this.$refs.terminal.clear();

      if (!query || query.length <= 1) {
        this.data = undefined;
        this.error = false;
        if (query.length == 1) {
          this.$refs.terminal.log({
            text: "Query is too short '" + query + "'",
            kind: "error"
          });
        }
        return;
      }

      const r = wq_query(query);
      let data = JSON.parse(r);

      if (data.valid == false) {
        this.$refs.terminal.log({text: "Query '" + query+ "': " + data.error, kind: "command-error"});
        if (this.data) {
          this.data.valid = false;
        }
      } else {
        this.$refs.terminal.log({text: "Query OK", kind: "command-ok" });
        this.data = data;
      }

      this.error = data.valid == false;
    },

    run_code(code) {
      this.$refs.terminal.clear();

      const r = wq_run(code);
      const data = JSON.parse(r);

      if (data.valid == false) {
        this.$refs.terminal.clear();
        this.$refs.terminal.log({text: "Code " + data.error, kind: "command-error"});
        if (this.data) {
          this.data.valid = false;
        }
      } else {
        if (!this.$refs.query.is_empty()) {
          this.$refs.query.refresh();
        }

        this.$refs.terminal.log({text: "Code OK", kind: "command-ok" });

        this.$refs.tree.update_expanded();
        this.select(this.selection);
      }
    },

    show_url() {
      const query = this.$refs.query.get_query();
      const plecs = this.$refs.plecs.get_code();

      const query_encoded = wq_encode(query);
      const plecs_encoded = wq_encode(plecs);
      
      this.url = window.location.protocol + '//' + 
                 window.location.host + 
                 window.location.pathname +
                 "?q=" + query_encoded + "&p=" + plecs_encoded;

      if (this.selection) {
        this.url += "&s=" + this.selection.path;
      }

      this.$refs.url.show();
    },

    select(e) {
      this.selection = e;
      if (e) {
        const r = wq_get_entity(e.path);
        let entity_data = JSON.parse(r);
        
        this.entity_data = entity_data;
      } else {
        this.entity_data = undefined;
      }

      if (this.entity_data) {
        this.$refs.inspector.expand();
      }
    },

    evt_select(entity) {
      this.$refs.tree.select(entity);
    }
  },

  data: {
    query_ok: "",
    error: false,
    data: undefined,
    entity_data: undefined,
    selection: undefined,
    url: undefined
  }
});
