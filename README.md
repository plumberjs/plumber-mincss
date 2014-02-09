plumber-mincss [![Build Status](https://travis-ci.org/plumberjs/plumber-mincss.png?branch=master)](https://travis-ci.org/plumberjs/plumber-mincss)
==============

CSS minimisation operation for [Plumber](https://github.com/plumberjs/plumber) pipelines.

## Example

    var mincss = require('plumber-mincss');

    module.exports = function(pipelines) {

        pipelines['css'] = [
            glob('stylesheets/**/*.css'),
            mincss(),
            // ... more pipeline operations
        ];

    };


## API

### `mincss()`

Minimise each input CSS resource.

Source maps for all input resources will be updated or generated accordingly.

