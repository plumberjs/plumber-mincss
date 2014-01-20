var mapEachResource = require('plumber').mapEachResource;

var q = require('q');
var less = require('less');


module.exports = function() {
    return mapEachResource(function(resource, supervisor) {
// TODO: check iff CSS

        var parser = new less.Parser({
            filename: resource.path().absolute()
        });
        var parse = q.denodeify(parser.parse.bind(parser));
        return parse(resource.data()).then(function(tree) {

            var sourceMapData;
            var cssData = tree.toCSS({
                compress: true,

                sourceMap: true,
                sourceMapFilename: resource.sourceMapFilename(),
                writeSourceMap: function writeSourceMap(data) {
                    // this whole pseudo async is somewhat ridiculous
                    sourceMapData = data;
                }
            });

            return resource.
                withData(cssData).
                withSourceMap(sourceMapData);
        });
    });
};
