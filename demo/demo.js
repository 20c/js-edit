(function($) {

twentyc.data.loaders.register(
  "test_data", 
  {
    test_data : function(id, config) {
      config.url = "test_data.json"
      this.XHRGet(id, config);
    }
  },
  "XHRGet"
);
twentyc.data.loaders.assign("test_data", "test_data")

twentyc.editable.target.register(
  "api",
  {
    "execute" : function() {
      var objectType = this.args[1];
      var method = this.args[2] || "post";
      var me = $(this);
      var data = this.data;
      $.ajax(
        {
          url : "/20c-js/js-edit/demo?"+objectType,
          method : method,
          data : this.data,
          success : function(response) {
            me.trigger("success", data);
          }
        }
      ).fail(function(response) { 
        me.trigger("error", {
          type : "HTTPError",
          info : response.status+" "+response.statusText
        }) 
      });
    }
  },
  "base"
);

twentyc.editable.input.get("bool").prototype.template_handlers["check"] = function(value, node, input) {
  node.addClass(value ? "yes" : "no")
}



$(document).ready(function() {
  $('#test').on("action-success:submit", function(ev, data) {
    console.log("Data successfully sent to server", ev, data);
  });
  $('#test').on("action-error:submit", function(ev, data) {
    console.log(data.reason, data.data);
  });
});


})(jQuery);
