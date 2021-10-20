
Vue.component('entity-component-value', {
  props: ['value', 'expand'],
  computed: {
    is_object: function() {
      return (typeof this.value) === "object";
    },
    css: function() {
      if (this.expand) {
        return "entity-component-value collapsible-container";
      } else {
        return "entity-component-value collapsible-container collapsed";
      }
    }
  },
  template: `
    <div :class="css">
      <div class="collapsible">
        <template v-if="is_object">
          <div class="entity-property" v-for="(v, k) in value">
            <span class="entity-property-key">{{k}}</span> <span class="entity-property-value">{{v}}</span>
          </div>
        </template>
        <template v-else>
          <div class="entity-property-value-kv">
            <span class="entity-property-key"></span> <span class="entity-property-value">{{value}}</span>
          </div>
        </template>
      </div>
    </div>
    `
});

Vue.component('entity-component', {
  props: ['prop'],
  data: function() {
    return {
      expand: true
    }
  },
  methods: {
    toggle: function() {
      this.expand = !this.expand;
    },
  },
  computed: {
    name_css: function() {
      if (this.prop.hidden) {
        return "entity-component-name entity-component-overridden";
      } else {
        return "entity-component-name";
      }
    },
    height: function() {
      if (this.expand) {
        return "auto";
      } else {
        return "0px";
      }
    },
    hide_property: function() {
      if (this.prop.pred == "flecs.doc.Description" || this.prop.pred == "Identifier") {
        return true;
      }
      return false;
    }
  },
  template: `
    <div class="entity-component" v-if="!hide_property">
      <div class="entity-component-label">
        <template v-if="prop.data">
          <div class="entity-component-expand-icon">
            <img src="nav-right.png" class="noselect entity-component-expand" v-if="!expand" v-on:click="toggle">
            <img src="nav-down.png" class="noselect entity-component-expand" v-if="expand" v-on:click="toggle">
          </div>
        </template>
        <template v-else>
          <div class="noselect entity-component-expand-nodata"></div>
        </template>
        <div :class="name_css">
          <span class="outer">
            <span class="inner">
              <entity-reference :entity="prop.pred" :show_name="true" v-on="$listeners"></entity-reference>
            </span>
          </span>
        </div>
        <template v-if="prop.obj">
          , <entity-reference :entity="prop.obj" :show_name="true" v-on="$listeners"></entity-reference>
        </template>
      </div>
      <entity-component-value v-if="prop.data !== undefined" :expand="expand" :value="prop.data">
      </entity-component-value>
    </div>
    `
});

Vue.component('entity-inspector-components', {
  props: ['entity'],
  template: `
    <div>
      <entity-component v-for="(prop, k) in entity.type" :prop="prop" :key="k" v-on="$listeners">
      </entity-component>
    </div>
    `
});

Vue.component('entity-inspector-base', {
  props: ['path', 'type'],
  template: `
    <div>
      <div class="entity-property-header">from {{path}}</div>
      <entity-component v-for="(prop, k) in type" :prop="prop" :key="k" v-on="$listeners">
      </entity-component>
    </div>
    `
});

Vue.component('entity-inspector', {
  props: ['entity', 'selection'],
  computed: {
    parent: function() {
      const pos = this.selection.path.lastIndexOf(".");
      if (pos != -1) {
        return this.selection.path.slice(0, pos);
      } else {
        return "";
      }
    },
    brief_description: function() {
      if (!this.entity) {
        return undefined;
      }

      if (!this.entity.type) {
        return undefined;
      }

      for (let i = 0; i < this.entity.type.length; i ++) {
        const obj = this.entity.type[i];
        if (obj.pred == "flecs.doc.Description" && obj.obj == "flecs.doc.Brief") {
          return obj.data.value;
        }
      }
    },
    link: function() {
      if (!this.entity) {
        return undefined;
      }

      if (!this.entity.type) {
        return undefined;
      }

      for (let i = 0; i < this.entity.type.length; i ++) {
        const obj = this.entity.type[i];
        if (obj.pred == "flecs.doc.Description" && obj.obj == "flecs.doc.Link") {
          return obj.data.value;
        }
      }
    }
  },
  template: `
    <div class="entity-inspector" v-if="entity">
      <div v-if="entity && entity.valid" class="ecs-table">
        <div class="entity-inspector-name">
          <div class="entity-inspector-icon">
            <entity-icon x="0" y="0" :entity_data="selection">
            </entity-icon>
          </div>
          {{selection.name}}
        </div>

        <span class="entity-inspector-parent" v-if="parent.length">
        - {{parent}}
        </span>

        <div class="entity-inspector-doc">
          <span class="entity-inspector-brief" v-if="brief_description">
            {{brief_description}}
          </span>
          <span class="entity-inspector-link" v-if="link">
            <a :href="link" target="_blank">[link]</a>
          </span>
        </div>

        <div class="entity-inspector-components">
          <template v-for="(v, k) in entity.is_a">
            <entity-inspector-base  :path="k" :type="v.type" v-on="$listeners">
            </entity-inspector-base>
          </template>

          <div v-if="entity.is_a" class="entity-property-header">from {{selection.path}}</div>
          <entity-inspector-components :entity="entity" v-on="$listeners">
          </entity-inspector-components>
        </div>
      </div>
    </div>
    `
});
