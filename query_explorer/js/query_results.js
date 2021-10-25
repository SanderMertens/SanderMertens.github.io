
Vue.component('query-result', {
  props: ['result', 'entity', 'show_terms'],
  template: `
  <tr>
    <td v-if="entity">
      <entity-reference :entity="entity" :show_name="true" v-on="$listeners"/>
    </td>
    <td v-for="variable in result.variables">
      <entity-reference :entity="variable" :show_name="true" v-on="$listeners"/>
    </td>
    <td v-if="show_terms" v-for="term in result.terms" class="content-container-term">
      {{term}}
    </td>
    <td class="content-container-squeeze"></td>
  </tr>
  `
});

Vue.component('query-results', {
    props: ['data'],
    data: function() {
      return {
        show_terms: false
      }
    },
    computed: {
      is_true: function(){
        if (!this.data) {
            return false;
        }
        if (this.error) {
            return false;
        }
        if (!this.data.results) {
            return false;
        }
        if (!this.data.results.length) {
            return false;
        }
        return true;
      },
      show_results: function() {
        if (this.is_true == false) {
          return false;
        }
        if (this.show_terms) {
          return true;
        }
        if (this.data.filter.has_this) {
          return true;
        }
        if (this.data.filter.variable_count != 0) {
          return true;
        }
        return false;
      },
      has_this: function() {
        if (this.data && this.data.filter) {
          return this.data.filter.has_this;
        } else {
          return false;
        }
      },
      variable_count: function() {
        if (this.data && this.data.filter) {
          return this.data.filter.variable_count;
        } else {
          return 0;
        }
      },
      variables: function() {
        if (this.data) {
          return this.data.variables;
        } else {
          return [];
        }
      },
      term_count: function() {
        if (this.data) {
          return this.data.term_count;
        } else {
          return [];
        } 
      },
      results: function() {
        if (this.data) {
          return this.data.results;
        } else {
          return [];
        } 
      },
      css: function() {
        let result = "query-results";
        if (this.data && !this.data.valid) {
          result += " query-results-invalid";
        }
        return result;
      }
    },
    template: `
      <div :class="css">
        <content-container :disable="!data">
          <template v-slot:summary>
            Query results
          </template>
          <template v-if="data && data.valid && !has_this && (variable_count == 0)" v-slot:detail>
            <div v-if="data && is_true" class="noselect query-result-yes"> Yes </div>
            <div v-else class="noselect query-result-no"> No </div>
          </template>
          <template v-else v-slot:detail>
            <table>
              <thead>
                <tr>
                  <th v-if="has_this">Entities</th>
                  <th v-for="var_name in variables" class="query-results-header">
                    {{var_name}}
                  </th>
                  <th v-for="(n, index) in term_count" class="query-results-header-term" v-if="show_terms">
                    Term {{index + 1}}
                  </th>
                  <th class="query-results-squeeze"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="result in results">
                  <template v-if="has_this">
                    <template v-for="entity in result.entities">
                      <query-result 
                        :entity="entity"
                        :result="result"
                        :show_terms="show_terms"
                        v-on="$listeners"/>
                    </template>
                  </template>
                  <template v-else>
                    <query-result 
                      :result="result" 
                      :show_terms="show_terms"
                      v-on="$listeners"/>
                  </template>
                </template>
              </tbody>
            </table>
          </template>
        </content-container>
      </template>
      </div>
      `
  });
