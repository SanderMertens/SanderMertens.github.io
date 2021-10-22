Vue.component('detail-toggle', {
  props: ['disable', 'collapse', 'hide_disabled', 'summary_toggle', "show_divider"],
  data: function() {
    return {
      should_expand: true
    }
  },
  methods: {
    toggle: function() {
      this.should_expand = !this.should_expand;
    },
    summary_clicked: function() {
      if (this.summary_toggle && !this.disable) {
        this.should_expand = !this.should_expand;
      }
    },
    expand: function() {
      this.should_expand = true;
    }  
  },
  computed: {
    expanded: function() {
      return this.should_expand && (this.collapse === undefined || this.collapse === false);
    },
    summary_css: function() {
      let result = "detail-toggle-summary";
      if (this.summary_toggle) {
        result += " clickable noselect";
      }
      return result;
    },
    detail_css: function() {
      let result = "detail-toggle-detail"
      if (!this.expanded) {
        result += " detail-toggle-detail-hide";
      }
      return result;
    }
  },
  template: `
    <div class="detail-toggle">
      <div :class="summary_css" v-on:click.stop="summary_clicked">
        <template v-if="!disable">
          <icon src="img/nav-right.png" v-on:click.stop="toggle" :rotate="expanded"/>
        </template>
        <template v-else>
          <div class="noselect detail-toggle-img" v-if="!hide_disabled">
            <svg width="20" height="20">
              <circle r="2" cx="10" cy="10" fill="#4F5565"/>
            </svg>
          </div>
        </template>

        <slot name="summary"></slot>

        <div class="detail-toggle-divider" v-if="show_divider"></div>
      </div>

      <div :class="detail_css">
        <slot name="detail"></slot>
      </div>
    </div>
  `
});
