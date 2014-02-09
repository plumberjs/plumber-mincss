var mapEachResource = require('plumber').mapEachResource;
var mercator = require('mercator');
var SourceMap = mercator.SourceMap;

var q = require('q');
var less = require('less');

// apply operation only when type matches
function whenType(type, op) {
    return function(resource, supervisor) {
        if (resource.type() === type) {
            return op(resource, supervisor);
        } else {
            return resource;
        }
    };
}

module.exports = function() {
    return mapEachResource(whenType('css', function(resource, supervisor) {
        var resourcePath = resource.path();
        var parser = new less.Parser({
            filename: resourcePath && resourcePath.absolute()
        });
        var parse = q.denodeify(parser.parse.bind(parser));
        return parse(resource.data()).then(function(tree) {
            var sourceMapData;
            var cssData = tree.toCSS({
                // cleancss is better than compress, but it doesn't
                // support source maps properly yet...
                // https://github.com/GoalSmashers/clean-css/issues/125
                compress: true,

                sourceMap: true,
                sourceMapFilename: resource.sourceMapFilename(),
                // fill sourcesContent
                outputSourceFiles: true,
                writeSourceMap: function writeSourceMap(data) {
                    // this whole pseudo async is somewhat ridiculous
                    sourceMapData = data;
                }
            });

            var data = mercator.stripSourceMappingComment(cssData);
            var sourceMap = SourceMap.fromMapData(sourceMapData);

            // If the source had a sourcemap, rebase the minimisation
            // sourcemap based on that original map
            var originalMapData = resource.sourceMap();
            if (originalMapData) {
               sourceMap = originalMapData.apply(sourceMap);
            }

            return resource.withData(data, sourceMap);
        });
    }));
};
