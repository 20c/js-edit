(function($) {

/**
 * twentyc.edit module that provides inline editing tools and functionality
 * for web content
 *
 * @module twentyc
 * @class editable
 * @static
 */

twentyc.editable = {
  
  /**
   * initialze all edit-enabled content
   *
   * called automatically on page load
   *
   * @method init
   * @private
   */

  init : function() {
    if(this.initialized)
      return;
    
    $('[data-edit-target]').editable();
    
    // hook into data load so we can update selects with matching datasets
    $(twentyc.data).on("load", function(ev, payload) {
      console.log("data load finished", payload);
      $('select[data-edit-data="'+payload.id+'"]').each(function(idx) {
        $(this).data("edit-input").load(payload.data)
      });
    });

    this.initialized = true;
  }
}

/**
 * humanize editable errors
 *
 * @module twentyc
 * @namespace editable
 * @class error
 * @static
 */

twentyc.editable.error = {

  /**
   * humanize the error of the specified type
   *
   * @method humanize
   * @param {String} errorType error type string (e.g. "ValidationErrors")
   * @returns {String} humanizedString
   */
  
  humanize : function(errorType) {
    switch(errorType) {
      case "ValidationErrors":
        return "Some of the fields contain invalid values - please correct and try again.";
      break;
      default:
        return "Something went wrong.";
      break;
    }
  }

}

/**
 * container for action handler
 * 
 * @module twentyc
 * @namespace editable
 * @class action
 * @extends twentyc.cls.Registry
 * @static
 */

twentyc.editable.action = new twentyc.cls.Registry();

twentyc.editable.action.register(
  "base", 
  {
    execute : function(trigger, container) {
      this.trigger = trigger
      this.container = container;
      if(this.loading_shim)
        this.container.children('.editable.loading-shim').show();
    },

    signal_error : function(container, error) {
      var payload = { 
        reason : error.type,
        info : error.info,
        data : error.data
      }
      container.trigger("action-error", payload);
      container.trigger("action-error:"+this._meta.name, payload);
      if(this.loading_shim)
        this.container.children('.editable.loading-shim').hide();
    },

    signal_success : function(container, payload) {
      container.trigger("action-success", payload);
      container.trigger("action-success:"+this._meta.name, payload);
      if(this.loading_shim)
        this.container.children('.editable.loading-shim').hide();
    }
  }
);

twentyc.editable.action.register(
  "toggle-edit",
  {
    execute : function(trigger, container) {
      this.base_execute(trigger, container);
      container.editable("toggle");
      container.trigger("action-success:toggle", { mode : container.data("edit-mode") });
    }
  },
  "base"
);


twentyc.editable.action.register(
  "submit",
  {
    loading_shim : true,
    execute : function(trigger, container) {
      this.base_execute(trigger, container);
      var targetParam = container.data("edit-target").split(":")

      // check if specified target has a handler, if not use standard XHR hander
      if(!twentyc.editable.target.has(targetParam[0])) 
        var handler = twentyc.editable.target.get("XHRPost")
      else
        var handler = twentyc.editable.target.get(targetParam[0])
      var me = this;

      try {
        
        // try creating target - this automatically parses form data
        // into object literal 
        
        var target = new handler(targetParam, container);
      
      } catch(error) {
        
        // we need to catch editable errors (identified by having type
        // set and fire off an event in case of failure - this also
        // catches validation errors

        if(error.type) {
          return this.signal_error(container, error);
        } else {
          
          // unknown errors are re-thrown so the browser can catch
          // them properly
          throw(error);
       
        }
      }

      $(target).on("success", function(ev, data) {
        me.signal_success(container, data);
        container.editable("toggle", { data : data });
      });
      $(target).on("error", function(ev, error) { 
        me.signal_error(container, error);
      });
      return target.execute();
    }
  },
  "base"
);

/**
 * allows you to setup and manage target handlers
 * 
 * @module twentyc
 * @namespace editable
 * @class target
 * @static
 */

twentyc.editable.target = new twentyc.cls.Registry();

twentyc.editable.target.register(
  "base",
  { 
    base : function(target, sender) {
      this.args = target;
      this.label = this.args[0]; 
      this.sender = sender;
      this.data = {}
      sender.editable("export", this.data)
    },
    data_valid : function() {
      return (this.data && this.data["_valid"]);
    },
    execute : function() {}
  }
);

twentyc.editable.target.register(
  "XHRPost",
  {
    execute : function() {
      var me = $(this), data = this.data;
      $.ajax({
        url : this.args[0],
        method : "POST",
        data : this.data,
        success : function(response) { 
          me.trigger("success", data); 
        }
      }).fail(function(response) {
        me.trigger(
          "error",
          {
            type : "HTTPError",
            info : response.status+" "+response.statusText
          }
        );
      });
    }
  },
  "base"
)

/**
 * allows you to setup and manage input types
 *
 * @module twentyc
 * @namespace editble
 * @class input
 * @static
 */

twentyc.editable.input = new (twentyc.cls.extend(
  "InputRegistry",
  {
    create : function(name, source, container) {
    
      var it = new (this.get(name));
      it.source = source
      it.container = container
      it.element = it.make();
      it.frame = $('<div class="editable input-frame"></div>');
      it.frame.append(it.element);
      it.set(source.data("edit-value"));

      if(it.placeholder)
        it.element.attr("placeholder", it.placeholder)

      it.element.focus(function(ev) {
        it.reset();
      });

      return it;
    }
  },
  twentyc.cls.Registry
));

twentyc.editable.input.register(
  "base",
  {
    
    set : function(value) {
      if(value == undefined) {
        this.element.val(this.source.text().trim());
      } else
        this.element.val(value);
    },
    
    get : function() {
      return this.element.val();
    },
    
    export : function() {
      return this.get()
    },
    
    make : function() {
      return $('<input type="text"></input>');
    },

    blank : function() {
      return (this.element.val() === "");
    },
    
    validate : function() {
      return true;
    },
    
    validation_message : function() {
      return "Invalid value"
    },

    required_message : function() {
      return "Input required"
    },

    load : function() {
      return;
    },
    
    apply : function(value) {
      this.source.html(this.get());
    },
    
    show_note : function(txt, classes) {
      var note = $('<div class="editable input-note"></div>');
      note.text(txt)
      note.addClass(classes);
      if(this.element.hasClass('input-note-relative'))
        note.insertAfter(this.element);
      else
        note.insertBefore(this.element);
       
      this.note = note;
      return note;
    },
    
    close_note : function() {
      if(this.note) {
        this.note.detach();
        this.note = null;
      }
    },
    
    show_validation_error : function(msg) {
      this.show_note(msg || this.validation_message(), "validation-error");
      this.element.addClass("validation-error");
    },
    
    reset : function() {
      this.close_note();
      this.element.removeClass("validation-error");
    }
  }
);

twentyc.editable.input.register(
  "string",
  {},
  "base"
);

twentyc.editable.input.register(
  "email",
  {
    placeholder : "name@domain.com",
    validate : function() {
      if(this.get() === "")
        return true
      return this.get().match(/@/);
    },
    validation_message : function() {
      return "Needs to be a valid email address";
    }
  },
  "string"
);

twentyc.editable.input.register(
  "url",
  {
    placeholder : "http://",

    validate : function() {
      var url = this.get()
      if(url === "")
        return true
      if(!url.match(/^[a-zA-Z]+:\/\/.+/)) {
        url = "http://"+url;
        this.set(url);
      }
      if(url.match(/\s/))
        return false;
      return true;
    },
    validation_message : function() {
      return "Needs to be a valid url";
    }
  },
  "string"
);


twentyc.editable.input.register(
  "number",
  {
    validate : function() {
      return this.element.val().match(/^[\d\.\,-]+$/)
    },
    validation_message : function() {
      return "Needs to be a number"
    }
  },
  "string"
);

twentyc.editable.input.register(
  "bool",
  {
    value_to_label : function() {
      return (this.element.prop("checked") ? "Yes" : "No");
    },

    make : function() {
      return $('<input class="editable input-note-relative" type="checkbox"></input>');
    },

    get : function() {
      return this.element.prop("checked");
    },

    set : function(value) {
      if(value == true)
        this.element.prop("checked", true);
      else
        this.element.prop("checked", false);
    },

    required_message : function() {
      return "Check required"
    },

    blank : function() {
      return this.get() != true;
    },

    apply : function(value) {
      this.source.data("edit-value", this.get());
      this.source.html(this.value_to_label());
    }
  },
  "base"
);

twentyc.editable.input.register(
  "text",
  { 
    make : function() {
      return $('<textarea></textarea>');
    }
  },
  "base"
);

twentyc.editable.input.register(
  "select",
  {
    make : function() {
      return $('<select></select>');
    },

    set : function() {
      var dataId, me = this;
      if(dataId=this.source.data("edit-data")) {
        twentyc.data.load(dataId, { 
          callback : function(payload) {
            me.load(payload.data);
          }
        });
      }
    },

    value_to_label : function() {
      return this.element.children('option:selected').text();
    },

    apply : function(value) {
      this.source.data("edit-value", this.get());
      this.source.html(this.value_to_label());
    },

    load : function(data) {
      var k, v, opt;
      this.element.empty();
      for(k in data) { 
        v = data[k];
        opt = $('<option></option>');
        opt.val(v.id);
        opt.text(v.name);
        if(v.id == this.source.data("edit-value"))
          opt.prop("selected", true);
        this.element.append(opt);
      }
    }
  },
  "base"
);

/*
 * jQuery functions
 */

$.fn.editable = function(action, arg) {

  /******************************************************************************
   * FILTERS
   */

  if(action == "filter") {

    // filter jquery result
    
    var matched = [];

    if(arg && typeof(arg) == "object") {
      // only proceed if arguments are provided
      var i = 0,
          l = this.length,
          result

      // BELONGS, shortcut for first_closest:["data-edit-target", target]
      if(arg.belongs) {
        arg.first_closest = ["[data-edit-target]", arg.belongs]
      }
      
      // FIRST CLOSEST, first_closest:[selector, result]

      if(arg.first_closest) {
        for(; i < l; i++) {
          closest = $(this[i]).closest(arg.first_closest[0]);
          if(closest.length && closest.get(0) == arg.first_closest[1].get(0))
            matched.push(this[i])
        }
      }


    }
    
    return this.pushStack(matched);
  }


  /******************************************************************************
   * ACTIONS
   */

  this.each(function(idx) {

    var me = $(this);
  
    var hasTarget = (me.data("edit-target") != null);
    var hasAction = (me.data("edit-action") != null);
    var hasType = (me.data("edit-type") != null);
  
    /****************************************************************************
     * INIT 
     **/
  
    if(!action && !me.data("edit-initialized")) {
      
      // mark as initialized so there is no duplicate init
      me.data("edit-initialized", true);

      // CONTAINER
  
      if(hasTarget) {
        
        console.log("init container", me.data("edit-target"))
        
        // init contained interactive elements
        me.find("[data-edit-action]").filter("a, input, select").editable(null, me)
  
        // init contained editable elements
        me.find("[data-edit-type]").editable(null, me)

        // create error message container
        var errorContainer = $('<div class="editable popin error"><div class="main"></div><div class="extra"></div></div>');
        errorContainer.hide();
        me.prepend(errorContainer)
        me.data("edit-error-container", errorContainer);

        // create loading shim
        var loadingShim = $('<div class="editable loading-shim"></div>');
        loadingShim.hide();
        me.prepend(loadingShim)
        me.data("edit-loading-shim", loadingShim);

        // whenever an action signals an error we want to update and show
        // the error container
        me.on("action-error", function(e, payload) {
          var popin = $(this).find(".editable.popin.error").editable("filter", { belongs : $(this) });
          popin.find('.main').html(twentyc.editable.error.humanize(payload.reason));
          popin.find('.extra').html(payload.info || "");
          popin.show();
        });

        // load required data-sets
        me.find('[data-edit-data]').editable('filter', { belongs : $(this) }).each(function(idx) {
          var dataId = $(this).data("edit-data");
          twentyc.data.load(dataId);
        });
        
      }
  
      // INTERACTIVE ELEMENT
  
      if(hasAction) {
        
        me.data("edit-parent", arg);

        var eventName = "click"
  
        if(
          me.data("edit-type") == "bool" ||
          me.data("edit-type") == "list" 
        ) 
        {
          eventName = "change";
        }
  
        // bind action event
        
        me.on(eventName, function() {
  
          var a = $(this).data("edit-action");
          if(typeof(twentyc.editable.action.get(a)) != "function")
            throw("Unknown action: " + a);

          var handler = new (twentyc.editable.action.get(a));
          console.log("Executing action", a);

          var r = handler.execute($(this), $(this).closest("[data-edit-target]"));
          me.trigger("action:"+a, r);
  
        });

      }
  
      // EDITABLE ELEMENT
  
      if(hasType) {
        
        // editable element
        me.data("edit-parent", arg);
  
      }
  
    }
  
    /****************************************************************************
     * TOGGLE
     **/
  
    else if(action == "toggle") {
      
      // toggle edit mode on or off
  
      var mode = me.data("edit-mode")
      
      if(hasTarget) {
        
        // CONTAINER
        
        if(mode == "edit") {
          me.find('[data-edit-toggled="edit"]').hide();
          me.find('[data-edit-toggled="view"]').show();
          mode = "view";

          if(!arg)
            me.trigger("edit-cancel");

        } else {
          me.find('[data-edit-toggled="edit"]').show();
          me.find('[data-edit-toggled="view"]').hide();
          mode = "edit";
        }
  
        me.find('.editable.popin').editable("filter", { belongs : me }).hide();
        me.find("[data-edit-type]").editable("filter", { belongs : me }).editable("toggle", arg);
  
      } else if(hasType) {
      
        // EDITABLE ELEMENT
  
        var input;
  
        if(mode == "edit") {
          
          // element is currently editable, switch it back to view-only
          // mode

          input = me.data("edit-input-instance")

          input.reset();

          if(arg && arg.data)
            input.apply(arg.data[me.data("edit-name")])
          else
            me.html(me.data("edit-content-backup"))

          me.data("edit-input-instance", null);
  
          mode = "view";
        } else {
          
          // element is currently not editable, switch it to edit mode
  
          input = twentyc.editable.input.create(
            me.data('edit-type'), 
            me, 
            me.closest("[data-edit-target]")
          );
  
          input.element.data('edit-input', input);
          input.element.data('edit-name', me.data('edit-name'));
          input.element.data('edit-type', me.data('edit-type'));
          input.element.addClass("editable "+ me.data("edit-type"));
  
          // store old content so we can switch back to it
          // in case of edit-cancel event
          me.data("edit-content-backup", me.html());
  
          // replace content with input
          me.data("edit-input-instance", input);
          me.empty();
          me.append(input.frame);
  
          mode = "edit";
        }
   
      }
  
      me.data("edit-mode", mode);
      me.trigger("toggle", [mode]);
  
    }
  
    /****************************************************************************
     * EXPORT FORM DATA 
     **/
  
    else if(action == "export") {

      // export form data to object literal
      
      
      if(hasTarget) {
        
        // container, find all inputs within, exit if not in edit mode
        if(me.data("edit-mode") != "edit")
          return;

        // track validation errors in here
        var validationErrors = {};
        arg["_valid"] = true;

        me.find('[data-edit-type]').editable("filter", { belongs : me }).each(function(k) {
          try {
            $(this).editable("export", arg)
          } catch(error) {
            if(error.type == "ValidationError") {
              validationErrors[error.field] = error.message;
              arg["_valid"] = false
            } else {
              throw(error);
            }
          }
        });
        arg["_validationErrors"] = validationErrors;

        // if data-edit-id is specified make sure to copy it to exported data
        // under _id
        if(me.data("edit-id") != undefined) {
          arg["_id"] = me.data("edit-id");
        }

        // check if payload element exists, and if it does add the data from
        // it to the exported data
        me.children('.payload').children('[data-edit-name]').each(function(idx) {
          var plel = $(this);
          arg[plel.data("edit-name")] = plel.text().trim();
        });

        if(!arg["_valid"])
          throw({type:"ValidationErrors", data:arg}); 
      
      } else if(hasType) {

        // editable element, see if input element exists and retrieve value
        var input;
        if(input=me.data("edit-input-instance")) {

          input.reset();

          // if input is required make sure it is not blank
          if(me.data("edit-required") == "yes") {
            if(input.blank()) {
              input.show_validation_error(input.required_message());
              throw({type:"ValidationError", field:me.data("edit-name"), message:input.required_message()})
            }
          }
          
          // validate input
          if(!input.validate()) {
            input.show_validation_error();
            throw({type:"ValidationError", field:me.data("edit-name"), message:input.validation_message()})
          }
          
          arg[me.data("edit-name")] = input.export();
        }
      }

    }

 
  });

};

/*
 * Init
 */

$(document).ready(function() {
  twentyc.editable.init();
});


})(jQuery);
