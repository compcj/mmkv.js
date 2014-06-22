var cluster = require('cluster'),
    async = require('async'),
    _ = require('lodash');

var Coordinator, Worker;

var MMKVServer = module.exports = function() {

}

MMKVServer.init = function(callback) {
    Coordinator = this.app.getComponent('Coordinator');
    Worker = this.app.getComponent('Worker');

    async.nextTick(_.bind(callback, this, null));
}

MMKVServer.main = function() {
    var mmkvServer = new MMKVServer();
    mmkvServer.run();
}

MMKVServer.prototype.runCoordinator = function() {
    var coordinator = new Coordinator();
    coordinator.run();
}

MMKVServer.prototype.runWorker = function() {
    var conf = {
        workerId: parseInt(process.env['workerId']),
        lb: parseInt(process.env['lb']),
        hb: parseInt(process.env['hb'])
    }

    var worker = new Worker(conf);
    worker.run();
}

MMKVServer.prototype.run = function() {
    if (cluster.isMaster) {
        this.runCoordinator();
    } else {
        this.runWorker();
    }
}