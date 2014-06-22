var argv = require('minimist')(process.argv.slice(2));

var App = require('./app.js');

var config = 'default';

if (argv._.length > 0) {
    config = argv._[0];
}

var app = new App(config, argv);

app.run();