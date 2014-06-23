var path = require('path'),
    async = require('async'),
    _ = require('lodash');

var App = module.exports = function(config, argv) {
    this.components = {};
    this.context = {};

    this.config = require(['.', 'config', config].join(path.sep));
    _.forOwn(this.config.argOverride, function(configPath, argName) {
        if (argv[argName] !== undefined) {
            setNested(this.config, configPath, argv[argName]);
        }
    }.bind(this));

    _.assign(GLOBAL, require(['.'].concat(this.config.consts.$config.split(':')).join(path.sep)));
    _.assign(GLOBAL, _.omit(this.config.consts, '$config'));

    _.forOwn(this.config.components, function(componentConf, componentName) {
        var implPath = ['.'].concat(componentConf.$impl.split(':'));
        this.components[componentName] = (require(implPath.join(path.sep)));
        _.assign(this.components[componentName], _.omit(componentConf, '$impl'));
        this.components[componentName].app = this;
    }.bind(this));
}

App.prototype.run = function() {
    async.each(_.filter(this.components, hasInit), function(component, callback) {
        component.init(callback);
    }, function(err) {
        if (err == null) {
            var mainComponentName = this.config.mainComponent.name;
            var entry = this.config.mainComponent.entry;

            this.mainComponent = this.getComponent(mainComponentName);
            this.mainComponent[entry]();
        } else {
            console.log('Error!Failed to initialize!');
            console.log(err.stack);
        }
    }.bind(this));
}

App.prototype.getComponent = function(name) {
    return this.components[name];
}

App.prototype.getConfig = function(name) {
    return this.config.appConfig[name];
}

var setNested = function(obj, path, value) {
    var fields = path.split(":");
    var result = obj, i, n;
    for (i = 0, n = fields.length - 1; i < n; i++) {
        result = result[fields[i]];
    }
    result[fields[i]] = value;
}

var hasInit = function(component) {
    return _.isFunction(component['init']);
}