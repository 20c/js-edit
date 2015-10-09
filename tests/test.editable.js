STORAGE = {};

DUMMY = {
  "first_name" : "John",
  "last_name" : "Smith",
  "customer" : "123"
}

DUMMY_CHANGED = {
  "first_name" : "John",
  "last_name" : "Smith",
  "customer" : "666"
}

DUMMY_SUB = {
  "extra" : "Something"
}

DUMMY_SUB_CHANGED = {
  "extra" : "other"
}

function clean(data) {
  var i, r= {};
  for(i in data) {
    if(i.charAt(0) != "_")
      r[i] = data[i];
  }
  return r;
}

function store(src, name) {
  STORAGE[name] = {}

  var i,v, dest = STORAGE[name];
  for(i in src) {
    if(i.charAt(0) != "_") {
      dest[i] = src[i];
    }
  }
}

twentyc.editable.target.register(
  "test",
  {
    "execute" : function() {
      var outcome = this.args[1] || "success";
      var storageId = this.args[2];
      if(outcome == "success") {
        store(this.data, storageId);
        $(this).trigger("success",this.data)
      } else
        $(this).trigger("error",{});
    }
  },
  "base"
);

function field_get(parent, name) {
  return parent.children('[data-edit-name="'+name+'"]').first();
} 

function field_env(source, callback) {
  var container = source.find(".input-frame").first();
  var input = container.children().first()
  callback(source, container, input);
}

function field_assert_toggled(assert, parent, name, value, tag) {
  field_env(field_get(parent, name), function(src, cont, input) {
    assert.equal(input.length, 1);
    assert.equal(input[0].tagName, tag.toUpperCase());
    assert.equal(src.data("edit-input-instance").get(), value);
    assert.equal(input.val(), value);
  });
}

function field_assert_untoggled(assert, parent, name, text) {
  var field = field_get(parent, name)
  assert.equal(field.text(), text);
}

function submit_form(parent) {
  parent.children('a[data-edit-action="submit"]').trigger("click");
}


QUnit.test("toggle", function(assert) {
  var node = $("#test_0_main").first()
  node.editable("toggle");
  field_assert_toggled(assert, node, "first_name", "John", "input");
  field_assert_toggled(assert, node, "customer", "123", "input");

  node.editable("toggle");
  field_assert_untoggled(assert, node, "first_name", "John");
  field_assert_untoggled(assert, node, "customer", "123");
});

QUnit.test("export and validate", function(assert) {
  var node = $("#test_1_main").first()
  node.editable("toggle");
  var data = {}
  node.editable("export", data);
  assert.equal(data.first_name, "John");
  assert.equal(data.last_name, "Smith");
  assert.equal(data.customer, "123");
  assert.equal(data._valid, true);

  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("bla");
  });

  var data = {};
  
  assert.throws(
    function() {
      node.editable("export", data);
    },
    function(err) {
      assert.equal(err.data._valid, false);
      assert.equal(err.data._validationErrors.customer, "Needs to be a number");
      return err.type == "ValidationErrors";
    }
  );
});

QUnit.test("save single", function(assert) {
  var node = $("#test_2_main").first()
  node.editable("toggle");
  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("666");
  });

  submit_form(node);

  assert.deepEqual(
    DUMMY_CHANGED,
    STORAGE.test_2
  );
});


QUnit.test("save single error handling", function(assert) {
  var node = $("#test_4_main").first()
  node.editable("toggle");
  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("brap");
  });
  var caught=false;
  node.on("action-error:submit", function(a,b) {
    caught=true;
    assert.equal(b.reason, "ValidationErrors");
  });
  submit_form(node);

  assert.equal(STORAGE.test_4, undefined);
  assert.equal(caught, true);

});


QUnit.test("save grouped", function(assert) {
  var node = $("#test_3_main").first()
  var nodeSub = node.find("#test_3_sub").first()
  var nodeSubC = node.find("#test_3_sub_c").first()
  node.editable("toggle");
  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("666");
  });
  field_env(field_get(nodeSub, "extra"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("other");
  });
  
  submit_form(node);

  assert.deepEqual(
    DUMMY_CHANGED,
    STORAGE.test_3
  );

  assert.deepEqual(
    DUMMY_SUB_CHANGED,
    STORAGE.test_3_b
  );

  field_assert_untoggled(assert, nodeSubC, "extra", "Something");
});

QUnit.test("save grouped error handling", function(assert) {
  var node = $("#test_5_main").first()
  var nodeSub = node.find("#test_5_sub").first()
  node.editable("toggle");
  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("666");
  });
  field_env(field_get(nodeSub, "extra"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("other");
  });
  
  submit_form(node);

  assert.deepEqual(
    DUMMY_CHANGED,
    STORAGE.test_5
  );

  assert.equal(STORAGE.test_5_b, undefined);

  field_assert_toggled(assert, node, "first_name", "John", "input");
  field_assert_toggled(assert, nodeSub, "extra", "other", "input");
});

QUnit.test("action success and error events", function(assert) {
  var node = $("#test_6_main").first()
  var nodeFail = $("#test_7_main").first()
  node.editable("toggle");
  field_env(field_get(node, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("666");
  });
  
  ev_a = false;
  ev_b = false;
  ev_c = false;
  ev_d = false;

  node.on("action-success:submit", function(e, data) {
    ev_a = true;
    assert.deepEqual(clean(data), STORAGE.test_6);
  });

  node.on("action-success", function(e, data) {
    ev_b = true;
    assert.deepEqual(clean(data), STORAGE.test_6);
  });

  submit_form(node);

  assert.equal(ev_a,true);
  assert.equal(ev_b,true);

  nodeFail.editable("toggle");
  field_env(field_get(nodeFail, "customer"), function(src, cont, input) {
    src.data("edit-input-instance").element.val("666");
  });
 
  nodeFail.on("action-error:submit", function(e, data) {
    ev_c = true;
  });

  nodeFail.on("action-error", function(e, data) {
    ev_d = true;
  });

  submit_form(nodeFail);

  assert.equal(ev_c,true);
  assert.equal(ev_d,true);



});

