
Vue.component('entity-reference', {
    props: ['entity', 'show_name', 'disabled', 'icon_link', 'label'],
    methods: {
      entity_clicked: function() {
        if (!this.disabled && !this.icon_link) {
          this.$emit('select-entity', this.entity);
        }
      },
      icon_clicked: function() {
        this.$emit('select-entity', this.entity);
      }
    },
    computed: {
      name: function() {
        if (this.show_name) {
          return this.entity.split('.').pop();
        } else {
          return this.entity;
        }
      },
      css: function() {
        if (!this.disabled && !this.icon_link) {
          return "entity-reference-link";
        } else {
          return "";
        }
      }
    },
    template: `
      <span class="entity-reference">
        {{label}}&nbsp;<span :class="css" v-on:click="entity_clicked">{{name}}</span>
        <icon src="img/open.png" v-on:click="icon_clicked"/>
      </span>
      `
  });
