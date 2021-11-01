
Vue.component('app-title', {
  props: ['value', 'remote'],
  methods: {
    refresh() {
      
    }
  },
  template: `
    <div class="app-title">
      <span>{{value}} <icon v-if="remote" src="connected"/></span>
    </div>
    `
});
  