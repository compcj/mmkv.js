var cluster = require('cluster'),
    async = require('async'),
    readline = require('readline'),
_ = require('lodash');

var Cli = module.exports = function(app) {
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    this.re = {
        getOp: /\s*get\s*\(\s*([0-9]+)\s*\)\s*/,
        getRangeOp: /\s*getRange\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*/,
        putOp: /\s*put\s*\(\s*([0-9]+)\s*,\s*(?:'|")(.*)(?:'|")\s*\)\s*/
    };
}

Cli.prototype.registerHandler = function(handler) {
    this.handler = handler;
}

Cli.prototype.interact = function(callback) {
    async.nextTick(callback);
    async.forever(
        function(next) {
            this.rl.question("Enter Operation:", function(ans) {
                var ret;
                if ((ret = this.re.getOp.exec(ans)) != null) {
                    var txs = [{
                        t: ACTION_GET,
                        k: parseInt(ret[1])
                    }];
                    this.handler(txs, function(err, result) {
                        console.log(result);
                        next();
                    });
                } else if ((ret = this.re.putOp.exec(ans)) != null) {
                    var txs = [{
                        t: ACTION_PUT,
                        k: parseInt(ret[1]),
                        v: ret[2]
                    }];
                    this.handler(txs, function(err, result) {
                        console.log(result);
                        next();
                    });
                } else if ((ret = this.re.getRangeOp.exec(ans)) != null) {
                    var txs = [{
                        t: ACTION_GETRANGE,
                        kl: parseInt(ret[1]),
                        ku: parseInt(ret[2])
                    }];
                    this.handler(txs, function(err, result) {
                        console.log(result);
                        next();
                    });
                } else {
                    console.log("Wrong format!");
                    next();
                }
            }.bind(this));
        }.bind(this),
        function(err) {

        }
    );
}

