/**
 * Created by compcj on 6/21/14.
 */
var cluster = require('cluster'),
    async = require('async'),
    http = require('http'),
    _ = require('lodash');

var JsonAPIInterface = module.exports = function(app) {

}

JsonAPIInterface.prototype.registerHandler = function(handler) {
    this.handler = handler;
}

JsonAPIInterface.prototype.interact = function(callback) {
    http.createServer(function (req, res) {
        if (req.url == '/do') {
            var body = '';
            req.on('data', function (chunk) {
                body += chunk;
            });
            req.on('end', function () {
                var txs;
                try {
                    txs = JSON.parse(body);
                } catch(e) {
                    console.log("Illegal input!");
                    res.writeHead(500);
                    res.end('Illegal input.');
                    return;
                }
                this.handler(txs, function(err, result) {
                    var retStr = JSON.stringify(result);
                    res.writeHead(200, {
                            'Content-Length': retStr.length,
                            'Content-Type': 'application/json' }
                    );
                    res.end(retStr);
                });
            }.bind(this));
        } else {
            res.writeHead(404);
            res.end('Not found.');
        }
    }.bind(this)).listen(cluster.isMaster? JsonAPIInterface.masterPort : JsonAPIInterface.workerPort + parseInt(process.env['workerId']), callback);
}