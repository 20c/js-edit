(function() {
/*
 * autocomplete input type for the django autocomplete-light
 * app
 */

twentyc.editable.input.register(
  "autocomplete",
  {
    make : function() {
      var input = this.string_make();
      input.on("focus", function() {
        input.addClass("invalid");
        input.removeClass("valid");
        input.data("value", 0);
        input.val("");
      });
      input.yourlabsAutocomplete(
        { 
          url : "/autocomplete/"+
                this.source.data("edit-autocomplete"),
          minimumCharacters : 2,
          choiceSelector : "span",
          inputClick : function(e) { return ; }
        }
      ).input.bind("selectChoice", function(a,b) {
        input.data("value" , b.data("value"));
        input.val(b.text());
        input.removeClass("invalid");
        input.addClass("valid");
      });
      return input;
    },
    get : function() {
      return this.element.data("value");
    },
    set : function(value) {
      if(value)
        var t = value.split(";");
      else
        var t = []
      this.element.data("value", t[0]);
      this.element.val(t[1]);
    },
    validate : function() {
      return this.get() > 0;
    }
  },
  "string"
);
})();
