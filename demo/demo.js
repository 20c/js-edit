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
          //url : "/api/"+objectType,
          url : "a.html",
          method : method,
          data : this.data,
          success : function(response) {
            me.trigger("success", data);
          }
        }
      );
    }
  },
  "base"
);

$(document).ready(function() {
  $('#test').on("action-success:submit", function(ev, data) {
    console.log("Data successfully sent to server", ev, data);
  });
  $('#test').on("action-error:submit", function(ev, data) {
    console.log(data.reason, data.data);
  });
});


})(jQuery);
