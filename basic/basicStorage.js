var cluster = require('cluster'),
    async = require('async'),
    _ = require('lodash');

var BasicStorage = module.exports = function(app) {
    this.storage = {};
}

BasicStorage.prototype.get = function(key) {
    return this.storage[key];
}

BasicStorage.prototype.getRange = function(keylb, keyhb) {
    var ret = [];
    for (var i = keylb; i <= keyhb; i++) {
        ret.push(this.storage[i]);
    }
    return ret;
}

BasicStorage.prototype.put = function(key, value) {
    return this.storage[key] = value;
}
