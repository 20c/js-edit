#js-edit

Flexible inline web-content editing

## Purpose

Provide the front end tools for making any content on your webpage editable via toggle.

  * Async form submission with automatic loading shims
  * Automatic validation based on input type
  * Extendible input type system
  * Create and re-use submission target handlers (basically an extended customizable version of the FORM action attribute)

## Requirements

    jquery 1.11.3
    github.com/20c/js-core 

## Install

    <script src="//code.jquery.com/jquery-1.11.3.min.js" type="text/javascript"></script>
    <script src="twentyc.core.js" type="text/javascript"></script>
    <script src="twentyc.edit.js" type="text/javascript"></script>
    <link href="twentyc.edit.css" type="text/css" rel="stylesheet" />

## Quickstart

### Creating the content

    <div>
      <div>Name: <span>John Smith</span></div>
      <div>Email: <span>john.smith@example.com</div>
    </div>

### Making it editable

Any content can be made editable by adding the editable class to the parent element and setting
the data-edit-type and data-edit-name attributes on the elements you wish to be editable within.

*data-edit-type* defines input type, see cheat sheet below to see current available types
*data-edit-name* defines input name, as it will be sent to the target handler

    <div class="editable" data-edit-target="/change-details" data-edit-id="1">
      <div>Name:
        <span data-edit-type="string"
              data-edit-name="name"
              data-edit-required="yes">
              John Smith
        </span>
      </div>
      <div>Email:
        <span data-edit-type="email"
              data-edit-name="email">
              john.smith@example.com
        </span>
      </div>
    </div>

    <!-- Controls to toggle edit on or off -->
    <div data-edit-toggled="view">
      <a class="button" data-edit-action="toggle-edit">Edit</a>
    </div>
    <div data-edit-toggled="edit" style="display:none;">
      <a class="button" data-edit-action="toggle-edit">Cancel</a>
      <a class="button" data-edit-action="submit">Save</a>
    </div>

Clicking save will validate the fields (client side) and use the standard XHR target handler to
send a request to /change-details containing the following:

    id="1"
    name="John Smith"
    email=john.smith@example.com"

### Defining custom input types

Example (a) - email input, extends string input not much needs to be changed

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

Example (b) - checkbox input, entirely different input type, extends base

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
    
### Defining custom target handlers

By default if you set data-edit-target to something that js-edit does not recognize as a target handler it
will assume its an endpoint on your server and do a simple XHR POST to it sending the data from the form.

However it is also possible to define custom target handlers in order to quickly standardize form submission across multiple forms all targeting the same API.

For example it's very easy to setup a target handle for a RESTful API endpoint.

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
              url : "/api/"+objectType,
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

Now you can set up your data-edit-target accordingly

    data-edit-target="api:person:post"
    data-edit-target="api:person:put"

These will all send requests with the specified method to

    /api/person

The simplicity of this example might make it seem a bit redundant, however keep in mind that defining
your own handler alos allows to manage data and the actual request before it is sent off.

Arguments are separated by :, first argument specifies the handler id, which is "api", the second argument specifies the endpoint and the third argument specifies the request method. Note that when defining your target handlers you can use as many arguments as you want or as few as 1.

