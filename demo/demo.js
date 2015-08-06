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

twentyc.editable.module.register(
  "api_listing",
  {
    loading_shim : true,
    add : function(rowId, trigger, container, data) {
      this.target.data = data;
      var me = this;
      console.log(this.target.data);
      new tc.u.SmartTimeout(function() {
        me.listing_add(new Date().getTime(), trigger, container, data);
        me.action.signal_success(container, rowId);
      }, 500);
 
    }, 
    remove : function(rowId, row, trigger, container) {
      this.target.data["id"] = rowId;
      this.target.args[2] = "DELETE";
      var me = this;
      console.log(this.target.data);
      new tc.u.SmartTimeout(function() {
        me.listing_remove(rowId, row, trigger, container);
        me.action.signal_success(container, rowId);
      }, 500);
    }
  },
  "listing"
);

twentyc.editable.input.get("bool").prototype.template_handlers["check"] = function(value, node, input) {
  node.addClass(value ? "yes" : "no")
}



$(document).ready(function() {
  $('#test, #test-always').on("action-success:submit", function(ev, data) {
    console.log("Data successfully sent to server", ev, data);
  });
  $('#test, #test-always').on("action-error:submit", function(ev, data) {
    console.log(data.reason, data.data);
  });
});


})(jQuery);
