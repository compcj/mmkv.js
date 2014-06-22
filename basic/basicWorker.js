var cluster = require('cluster'),
    async = require('async'),
    _ = require('lodash');

var Storage, Interface;

var BasicWorker = module.exports = function(conf) {
    this.workerId = conf.workerId;
    this.lb = conf.lb;
    this.hb = conf.hb;
    this.seq = 0;
    this.storage = new Storage();
    this.window = {};
}

BasicWorker.init = function(callback) {
    Storage = BasicWorker.app.getComponent('Storage');
    Interface = BasicWorker.app.getComponent('Interface');

    async.nextTick(_.bind(callback, this, null));
}

BasicWorker.prototype.run = function() {



    console.log("Worker " + this.workerId + " Started. Key ranged from " + this.lb + " to " + this.hb + ".");

    process.on('message', function(msg) {
        this.doTransaction(msg.txs, msg.seq, _.partialRight(function(err, result, txSeq) {
            process.send({
                txSeq: txSeq,
                result: result
            });
        }, msg.txSeq).bind(this));
    }.bind(this));
    if (BasicWorker.disableInterface === undefined) {
        var intf = new Interface();
        intf.registerHandler(this.doDirectTransaction.bind(this));
        intf.interact(function(err) {
            if (err == null) {
                process.send({
                    type: MSG_WORKER_READY
                });
            } else {
                process.send({
                    type: MSG_WORKER_FAILED
                });
            }
        });
    } else {
        process.send({
            type: MSG_WORKER_READY
        });
    }

}

BasicWorker.prototype.doDirectTransaction = function(txs, callback) {
    var len = txs.length;
    var result = [];
    for (var i = 0; i < len; i++) {
        result.push(this.execute(txs[i]));
    }
    async.nextTick(_.partial(callback, null, result));
}

BasicWorker.prototype.doTransaction = function(txs, seq, callback) {
    this.window[seq] = {
        txs: txs,
        callback: callback
    };
    if (seq == this.seq) {
        while (_.has(this.window, seq)) {
            var job = this.window[seq];
            var result = this.doDirectTransaction(job.txs, job.callback);
            delete this.window[seq];
            seq++;
            this.seq++;
        }
    }
}

BasicWorker.prototype.execute = function(tx) {
    if (tx.t == ACTION_GET) {
        return this.get(tx.k);
    } else if (tx.t == ACTION_GETRANGE) {
        return this.getRange(tx.kl, tx.ku);
    } else if (tx.t == ACTION_PUT) {
        return this.put(tx.k, tx.v);
    }
}

BasicWorker.prototype.get = function(k) {
    return this.storage.get(k);
}

BasicWorker.prototype.getRange = function(kl, ku) {
    return this.storage.getRange(kl, ku);
}

BasicWorker.prototype.put = function(k, v) {
    return this.storage.put(k, v);
}