window.FLECS_TOUR = {
  nodes: [],
  register: function (list) {
    for (var i = 0; i < list.length; i++) {
      this.nodes.push(list[i]);
    }
  },
};

window.FLECS_DIR = {
  types: [],
  register: function (list) {
    for (var i = 0; i < list.length; i++) {
      this.types.push(list[i]);
    }
  },
};
