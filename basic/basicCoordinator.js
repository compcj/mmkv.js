var cluster = require('cluster'),
    async = require('async'),
    _ = require('lodash');

var Interface;

var BasicCoordinator = module.exports = function(app) {
    this.workers = [];
    this.workerKeyRange = [];
    this.workerSeq = [];

    this.txs = {};

    this.txSeq = 0;
    this.keyMax = BasicCoordinator.app.getConfig('keyMax');
    this.ready = 0;
}

BasicCoordinator.init = function(callback) {
    Interface = BasicCoordinator.app.getComponent('Interface');

    async.nextTick(_.bind(callback, this, null));
}

BasicCoordinator.prototype.run = function() {
    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died with code ' + code + " signal " + signal + ".");
    });

    for (var i = 0; i < BasicCoordinator.numOfWorkers; i++) {
        var lowerBound = Math.floor(this.keyMax / BasicCoordinator.numOfWorkers * i),
            upperBound = Math.floor(this.keyMax  / BasicCoordinator.numOfWorkers * (i + 1)) - 1;

        var worker = cluster.fork({
            workerId: this.workers.length,
            lb: lowerBound,
            hb: upperBound
        }).on('message', function(msg) {
            if (msg.type == MSG_WORKER_READY) {
                this.ready++;
            } else if (msg.type == MSG_WORKER_FAILED) {
                console.log('Some worker has failed.');
            }
            if (this.ready == BasicCoordinator.numOfWorkers) {
                for (var j = 0; j < BasicCoordinator.numOfWorkers; j++) {
                    this.workers[j].removeAllListeners('message');
                }
                async.nextTick(this.serve.bind(this));
            }
        }.bind(this));

        this.workers.push(worker);
        this.workerSeq.push(0);
        this.workerKeyRange.push({
            kl: lowerBound,
            ku: upperBound
        });
    }
}

BasicCoordinator.prototype.serve = function() {
    var intf = new Interface();
    intf.registerHandler(this.doTransaction.bind(this));
    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].on('message', this.handleResult.bind(this, i));
    }
    console.log("Coordinator started!");

    intf.interact(function(err) {
    });
}

BasicCoordinator.prototype.getKeyWorker = function(key) {
    return Math.floor(key / (this.keyMax / BasicCoordinator.numOfWorkers));
}

BasicCoordinator.prototype.doTransaction = function(txs, callback) {
    var workerTxs = new Array(BasicCoordinator.numOfWorkers);
    for (var i = 0; i < BasicCoordinator.numOfWorkers; i++) {
        workerTxs[i] = [];
    }
    var txLen = txs.length;
    this.txs[this.txSeq] = {
        result: new Array(BasicCoordinator.numOfWorkers),
        merge: new Array(txLen),
        workers: 0,
        callback: callback
    };

    for (var i = 0; i < txLen; i++) {
        if (txs[i].t == ACTION_GET) {
            var w = this.getKeyWorker(txs[i].k);
            workerTxs[w].push(txs[i]);
            this.txs[this.txSeq].merge[i] = [w];
        } else if (txs[i].t == ACTION_PUT) {
            var w = this.getKeyWorker(txs[i].k);
            workerTxs[w].push(txs[i]);
            this.txs[this.txSeq].merge[i] = [w];
        } else { //ACTION_GETRANGE
            var wl = this.getKeyWorker(txs[i].kl),
                wu = this.getKeyWorker(txs[i].ku);
            for (var j = wl; j <= wu; j++) {
                workerTxs[j].push({
                    t: ACTION_GETRANGE,
                    kl: j != wl ? this.workerKeyRange[j].kl: txs[i].kl,
                    ku: j != wu ? this.workerKeyRange[j].ku: txs[i].ku
                });
            }
            this.txs[this.txSeq].merge[i] = [wl, wu];
        }
    }

    for (var i = 0; i < BasicCoordinator.numOfWorkers; i++) {
        if (workerTxs[i].length != 0) {
            this.workers[i].send({
                txs: workerTxs[i],
                seq: this.workerSeq[i]++,
                txSeq: this.txSeq
            });
            this.txs[this.txSeq].workers++;
        }
    }

    this.txSeq++;
}

BasicCoordinator.prototype.handleResult = function(workerId, msg) {
    var txSeq = msg.txSeq;
    var tx = this.txs[txSeq];
    var txLen = tx.merge.length;
    var result = new Array(txLen);
    var pointer = new Array(BasicCoordinator.numOfWorkers);
    for (var i = 0; i < BasicCoordinator.numOfWorkers; i++) {
        pointer[i] = 0;
    }
    tx.result[workerId] = msg.result;
    tx.workers--;
    if (this.txs[txSeq].workers == 0) { //job done
        for (var i = 0; i < txLen; i++) {
            if (tx.merge[i].length == 1) { //single
                var w = tx.merge[i][0];
                result[i] = tx.result[w][pointer[w]++];
            } else { //multiple
                var wl = tx.merge[i][0], wu = tx.merge[i][1];
                result[i] = tx.result[wl][pointer[wl]++];
                for (var j = wl + 1; j <= wu; j++) {
                    result[i] = result[i].concat(tx.result[j][pointer[j]++]);
                }
            }
        }
        async.nextTick(_.partial(tx.callback, null, result));
        delete this.txs[txSeq];
    }
}