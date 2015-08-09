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
    
    this.templates.init();

    $('[data-edit-target]').editable();
    
    // hook into data load so we can update selects with matching datasets
    $(twentyc.data).on("load", function(ev, payload) {
      console.log("data load finished", payload);
      $('select[data-edit-data="'+payload.id+'"]').each(function(idx) {
        $(this).data("edit-input").load(payload.data)
      });
    });

    // init modules
    $('[data-edit-module]').each(function(idx) {
      var module = twentyc.editable.module.instantiate($(this));
      module.init();
    });

    // initialize always toggled inputs
    $('.editable.always').each(function(idx) {
      var container = $(this);
      container.find('[data-edit-type]').editable(
        'filter', { belongs : container } 
      ).each(function(idx) {
        $(this).data("edit-always", true);
        twentyc.editable.input.manage($(this), container);
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
    
    name : function() {
      return this._meta.name;
    },

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
      container.trigger("action-error:"+this.name(), payload);
      if(this.loading_shim)
        this.container.children('.editable.loading-shim').hide();
    },

    signal_success : function(container, payload) {
      container.trigger("action-success", payload);
      console.log("SIGNAL SUCCESS",this.name());
      container.trigger("action-success:"+this.name(), payload);
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

      var me = this,
          modules = [],
          i;

      try {
        
        // try creating target - this automatically parses form data
        // into object literal 
        
        var target = twentyc.editable.target.instantiate(container);
      
        // prepare modules
        container.find("[data-edit-module]").
          editable("filter", { belongs : container }).
          each(function(idx) {
            var module = twentyc.editable.module.instantiate($(this));
            module.prepare();
            modules.push([module, $(this)])
          });

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

      // submit main target
      var result = target.execute();
      
      // submit grouped targets
      container.editable("filter", { grouped : true }).not("[data-edit-module]").each(function(idx) {
        var other = $(this);
        var action = new (twentyc.editable.action.get("submit"))();
        action.execute(trigger, other);
      });

      // submit modules
      for(i in modules) {
        modules[i][0].execute(trigger, modules[i][1]);
      }

      return result;
    }
  },
  "base"
);

twentyc.editable.action.register(
  "module-action",
  {
    name : function() {
      return this.module._meta.name+"."+this.actionName;
    },
    execute : function(module, action, trigger, container) {
      this.base_execute(trigger, container);
      this.module = module;
      this.actionName = action;
      module.action = this;
      $(module.target).on("success", function(ev, d) {
        module.action.signal_success(container, d);
      });
      $(module.target).on("error", function(ev, error) {
        module.action.signal_error(container, error);
      });
      try {
        this.module["execute_"+action](trigger, container);
      } catch(error) {

        if(error.type) {
          return this.signal_error(container, error);
        } else {
          
          // unknown errors are re-thrown so the browser can catch
          // them properly
          throw(error);
       
        }
 
      }
    }
  },
  "base"
);

/**
 * container for module handler
 *
 * @module twentyc
 * @namespace editable
 * @class module
 * @extends twentyc.cls.Registry
 * @static
 */

twentyc.editable.module = new twentyc.cls.Registry();

twentyc.editable.module.instantiate = function(container) {
  var module = new (this.get(container.data("edit-module")))(container);
  return module;
};

/**
 * base module to use for all editable modules
 *
 * modules allow you add custom behaviour to forms / editing process
 *
 * @class base
 * @namespace twentuc.editable.module
 * @constructor
 */

twentyc.editable.module.register(
  "base", 
  {
    init : function() {
      return;
    },

    base : function(container) {
      var comp = this.components = {};
      container.find("[data-edit-component]").each(function(idx) {
        var c = $(this);
        comp[c.data("edit-component")] = c;
      });
      this.container = container;
    },

    execute : function(trigger, container) {
      var me = $(this), action = trigger.data("edit-action");

      this.trigger = trigger;
      this.target = twentyc.editable.target.instantiate(container);
     
      handler = new (twentyc.editable.action.get("module-action"))
      handler.loading_shim = this.loading_shim;
      handler.execute(this, action, trigger, container);
    },

    prepare : function() { return; },

    execute_submit : function(trigger, container) {
      return;
    }
  }
);

/**
 * this module allows you maintain a listing of items with functionality
 * to add, remove and change the items.
 *
 * @class listing
 * @namespace twentyc.editable.module
 * @constructor
 * @extends twentyc.editable.module.base
 */

twentyc.editable.module.register(
  "listing",
  {
    
    pending_submit : [],

    init : function() {
      
      // a template has been specified for the add form
      // try to build add row form from it
      if(this.components.add.data("edit-template")) {
        var addrow = twentyc.editable.templates.copy(this.components.add.data("edit-template"));
        this.components.add.prepend(addrow);
      }
    },

    prepare : function() {
      var pending = this.pending_submit = [];
      this.components.list.children().each(function(idx) {
        var row = $(this),
            data = {};

        var changedFields = row.find("[data-edit-type]").
            editable("filter", "changed");

        if(changedFields.length == 0)
          return;

        row.find("[data-edit-type]").editable("export-fields", data);
        row.editable("collect-payload", data);
        pending.push({ row : row, data : data, id : row.data("edit-id")});
      });
    },

    add : function(rowId, trigger, container, data) {
      var row = twentyc.editable.templates.copy(this.components.list.data("edit-template"))
      var k;
      row.attr("data-edit-id", rowId);
      row.data("edit-id", rowId);
      for(k in data) {
        row.find('[data-edit-name="'+k+'"]').text(data[k]);
      }
      row.appendTo(this.components.list);
      container.editable("sync");
      this.action.signal_success(container, rowId);
      container.trigger("listing:row-add", [rowId, row, data, this]);
    },

    remove : function(rowId, row, trigger, container) {
      row.detach();
      this.action.signal_success(container, rowId);
      container.trigger("listing:row-remove", [rowId, row, this]);
    },

    submit : function(rowId, data, row, trigger, container) {
      this.action.signal_success(container, rowId);
      container.trigger("listing:row-submit", [rowId, row, data, this]);
    },

    execute_submit : function(trigger, container) {
      console.log("listing submit");
      var i, P;
      if(!this.pending_submit.length) {
        this.action.signal_success(container);
        return;
      }
      for(i in this.pending_submit) {
        P = this.pending_submit[i];
        this.submit(P.id, P.data, P.row, trigger, container);
      }
    },

    execute_add : function(trigger, container) {
      var data = {};
      this.components.add.editable("export", data);
      this.data = data
      this.add(null,trigger, container, data);
    },

    execute_remove : function(trigger, container) {
      var row = trigger.closest("[data-edit-id]").first();
      this.remove(row.data("edit-id"), row, trigger, container);
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

twentyc.editable.target.instantiate = function(container) {
  var handler,
      targetParam = container.data("edit-target").split(":")

  // check if specified target has a handler, if not use standard XHR hander
  if(!twentyc.editable.target.has(targetParam[0])) 
    handler = twentyc.editable.target.get("XHRPost")
  else
    handler = twentyc.editable.target.get(targetParam[0])
  
  // try creating target - this automatically parses form data
  // into object literal 
  return new handler(targetParam, container);
}

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
    
    frame : function() {
      var frame = $('<div class="editable input-frame"></div>');
      return frame;
    },

    manage : function(element, container) {
      
      var it = new (this.get(element.data("edit-type")));
      var par = element.parent()

      it.container = container;
      it.element = element;
      it.frame = this.frame();

      it.frame.insertBefore(element);
      it.frame.append(element);

      it.original_value = it.get();

      element.data("edit-input-instance", it);
     
      return it;
    },

    create : function(name, source, container) {
    
      var it = new (this.get(name));
      it.source = source
      it.container = container
      it.element = it.make();
      it.frame = this.frame();
      it.frame.append(it.element);
      it.set(source.data("edit-value"));

      it.original_value = it.get();

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

    changed : function() {
      return (this.original_value != this.get());
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
      if(!this.source.data("edit-template")) 
        this.source.html(this.get());
      else {
        var tmplId = this.source.data("edit-template");
        var tmpl = twentyc.editable.templates.get(tmplId);
        var node = tmpl.clone(true);
        if(this.template_handlers[tmplId]) {
          this.template_handlers[tmplId](value, node, this);
        }
        this.source.empty().append(node);
      }
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
    },

    template_handlers : {}
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
    },

    template_handlers : {
      "link" : function(value, node) {
        node.attr("href", "mailto:"+value).html(value);
      }
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
    },
    template_handlers : {
      "link" : function(value, node) {
        node.attr("href", value).html(value);
      }
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
      if(!this.source.data("edit-template")) { 
        this.source.html(this.value_to_label());
      } else {
        var tmplId = this.source.data("edit-template");
        var tmpl = twentyc.editable.templates.get(tmplId);
        var node = tmpl.clone(true);
        if(this.template_handlers[tmplId]) {
          this.template_handlers[tmplId](value, node, this);
        }
        this.source.empty().append(node);
      }

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

/**
 * class that managed DOM templates
 *
 * @class templates
 * @namespace twentyc.editable.templates
 * @static
 */

twentyc.editable.templates = {
  
  _templates : {},

  register : function(id, node) {
    if(this._templates[id])
      throw("Duplicate template id: "+id);
    this._templates[id] = node;
  },

  get : function(id) {
    if(!this._templates[id])
      throw("Tried to retrieve unknown template: "+id);
    return this._templates[id];
  },

  copy : function(id) {
    return this.get(id).clone().attr("id", null);
  },

  init : function() {
    if(this.initialized)
      return;

    $('#editable-templates').children().each(function(idx) {
      twentyc.editable.templates.register(
        this.id,
        $(this)
      );
    });

    this.initialized = true;
  }

}

twentyc.editable.templates.register("link", $('<a></a>'));

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

    if(arg) {
      // only proceed if arguments are provided
      var i = 0,
          l = this.length,
          input,
          node,
          nodes,
          closest,
          result

      // BELONGS (container), shortcut for first_closest:["data-edit-target", target]
      if(arg.belongs) {
        arg.first_closest = ["[data-edit-target], [data-edit-component]", arg.belongs]
      }

      // FIRST CLOSEST, first_closest:[selector, result]

      if(arg.first_closest) {
        for(; i < l; i++) {
          closest = $(this[i]).parent().closest(arg.first_closest[0]);
          if(closest.length && closest.get(0) == arg.first_closest[1].get(0))
            matched.push(this[i])
        }
      }

      // GROUPED

      else if(arg.grouped) {
        for(; i < l; i++) {
          node = $(this[i]);
          if(node.data("edit-group"))
            continue;
          nodes = $('[data-edit-group]').each(function(idx) {
            var other = $($(this).data("edit-group"));
            if(other.get(0) == node.get(0))
              matched.push(this);
          });
        }
      }

      // CHANGED FIELDS

      else if(arg == "changed") {
        
        for(; i < l; i++) {
          node = $(this[i]);
          input = node.data("edit-input-instance")
          if(input && input.changed()) {
            matched.push(this[i])
          }
        }

      }
    }
    
    return this.pushStack(matched);
  } else if(action == "export-fields") {

    // track validation errors in here
    var validationErrors = {};
    arg["_valid"] = true;

    // collect values from editable fields
    this.each(function(idx) {
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

    if(!arg["_valid"]) {
      throw({type:"ValidationErrors", data:arg}); 
    }

  } else if(action == "collect-payload") {

    this.find(".payload").children('[data-edit-name]').each(function(idx) {
      var plel = $(this);
      arg[plel.data("edit-name")] = plel.text().trim();
    });
 
  }


  /******************************************************************************
   * ACTIONS
   */

  this.each(function(idx) {

    var me = $(this);
  
    var hasTarget = (me.data("edit-target") != null);
    var isComponent = (me.data("edit-component") != null);
    var isContainer = (hasTarget || isComponent);
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
        if(me.hasClass("always"))
          me.data("edit-mode", "edit");
        else
          me.data("edit-mode", "view");
 
        me.editable("sync");

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
  
          var handler, a = $(this).data("edit-action");
          var container = $(this).closest("[data-edit-target]");
          if(!twentyc.editable.action.has(a)) { 
            if(container.data("edit-module")) {
              handler = twentyc.editable.module.instantiate(container);
            }
            if(!handler)
              throw("Unknown action: " + a);
          } else
            handler = new (twentyc.editable.action.get(a));
          console.log("Executing action", a);

          var r = handler.execute($(this), container);
          me.trigger("action:"+a, r);
  
        });

        me.data("edit-parent", arg);

      }
  
      // EDITABLE ELEMENT
  
      if(hasType) {
        
        // editable element
        me.data("edit-parent", arg);
  
      }
  
    }

    /****************************************************************************
     * SYNC
     **/
    
    else if(action == "sync") {

      var mode = me.data("edit-mode") || "view";
        
      // init contained interactive elements
      me.find("[data-edit-action]").
        filter("a, input, select").
        editable("filter", {belongs:me}).
        each(function(idx) {
          var child = $(this);
          if(!child.data("edit-parent"))
            child.editable(null, me)
        });
  
      // init contained editable elements
      me.find("[data-edit-type]").
        editable("filter", { belongs : me }).
        each(function(idx) {
          var child = $(this);
          if(!child.data("edit-parent"))
            child.editable(null, me)
          if((child.data("edit-mode")||"view") != mode) 
            child.editable("toggle");
        });

      // load required data-sets
      me.find('[data-edit-data]').
        editable('filter', { belongs : me }).
        each(function(idx) {
          var dataId = $(this).data("edit-data");
          twentyc.data.load(dataId);
        });

      // toggle mode-toggled content
      me.find('[data-edit-toggled]').
         editable('filter', { belongs : me }).
         each(function(idx) {
           var child = $(this);
           if(child.data("edit-toggled") != mode)
             child.hide()
           else
             child.show()
         });

      // sync components
      me.find('[data-edit-component]').
        editable('filter', { belongs : me }).
        editable('sync');

    }

    /****************************************************************************
     * TOGGLE
     **/
  
    else if(action == "toggle") {
      
      // toggle edit mode on or off
  
      var mode = me.data("edit-mode")

      if(me.hasClass("always"))
        return;

      
      if(isContainer) {
        
        // CONTAINER

        if(mode == "edit") {
          me.find('[data-edit-toggled="edit"]').editable("filter", { belongs : me }).hide();
          me.find('[data-edit-toggled="view"]').editable("filter", { belongs : me }).show();
          mode = "view";

          me.removeClass("mode-edit")

          if(!arg)
            me.trigger("edit-cancel");

        } else {
          me.find('[data-edit-toggled="edit"]').editable("filter", { belongs : me }).show();
          me.find('[data-edit-toggled="view"]').editable("filter", { belongs : me }).hide();
          mode = "edit";

          me.addClass("mode-edit")
        }
 
        // hide pop-ins
        me.find('.editable.popin').editable("filter", { belongs : me }).hide();

        // toggled editable elements
        me.find("[data-edit-type], [data-edit-component]").editable("filter", { belongs : me }).editable("toggle", arg);

        // toggle other containers that are flagged to be toggled by this container

        me.editable("filter", { grouped : 1 }).each(function(idx) {
          $(this).editable("toggle", arg);
        });
        
  
      } else if(hasType) {
      
        // EDITABLE ELEMENT
  
        var input;

        if(me.data("edit-always"))
          return;
  
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
     * TOGGLE LOADING SHIM
     **/

    else if(action == "loading-shim") {
      if(arg == "show" || arg == "hide") {
        me.children(".editable.loading-shim")[arg]();
      }
    }

    /****************************************************************************
     * EXPORT FORM DATA 
     **/
  
    else if(action == "export") {

      // export form data to object literal
      
      
      if(isContainer) {
        
        // container, find all inputs within, exit if not in edit mode
        if(me.data("edit-mode") != "edit" && !me.hasClass("always"))
          return;

        // export all the fields that belong to this container
        me.find('[data-edit-type]').
           editable("filter", { belongs : me }).
           editable("export-fields", arg);

        // if data-edit-id is specified make sure to copy it to exported data
        // under _id
        if(me.data("edit-id") != undefined) {
          arg["_id"] = me.data("edit-id");
        }
    
        // check if payload element exists, and if it does add the data from
        // it to the exported data
        me.editable("collect-payload", arg);
     
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
