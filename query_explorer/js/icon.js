
Vue.component('icon', {
  props: ['src', 'rotate'],
  computed: {
    css: function() {
      if (this.rotate) {
        return "icon icon-rotate";
      } else {
        return "icon";
      }
    }
  },
  template: `
    <span :class="css">
      <img :src="src" class="noselect icon clickable" v-on="$listeners"/>
    </span>
    `
});
