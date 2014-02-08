// Underscore.js templating setup
_.templateSettings = {
    evaluate    : /\{%([\s\S]+?)%\}/g,
    interpolate : /\{%=([\s\S]+?)%\}/g,
    escape      : /\{%-([\s\S]+?)%\}/g
};

// jQuery setup
$.ajaxSetup({
    cache: false
});

// Backbone
Backbone.Model.prototype.partialUpdate = function(attrs) {
    attrs.id = this.id;
    this.clear({
        silent: true
    });
    this.save(attrs, {
        silent: true,
        success: function(m) {
            m.change();
        }
    });
};
Backbone.Model.prototype.partialSave = function(attrs, restoreOnError, options) {
    var me = this;
    
    attrs.id = me.id;
    
    if (restoreOnError) {
        var prev = me.clone();
        var error = options.error;
        options.error = function(model, response){
            me.set(prev.toJSON(), {
                silent: true
            });
            if ($.isFunction(error)) {
                error.call(this, model, response);
            }
        };
    }
    
    me.clear({
        silent: true
    });
    me.save(attrs, options);
};

// Commons
DateUtils = {
    formatDateTime: function(value, format) {
        var date = _.isString(value) ? new Date(Date.parse(value)) : new Date(value);
        return date.format(format ? format : 'dd.mm.yyyy HH:MM');
    }
};
