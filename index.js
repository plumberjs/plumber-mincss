var operation = require('plumber').operation;
var mercator = require('mercator');
var SourceMap = mercator.SourceMap;

var highland = require('highland');
var less = require('less');

// apply operation only when type matches
function whenType(type, op) {
    return function(resource) {
        if (resource.type() === type) {
            return op(resource);
        } else {
            return resource;
        }
    };
}

module.exports = function() {
    // FIXME: using operation.parallelFlatMap causes tests to fail?
    return operation(function(resources) {
        return resources.flatMap(whenType('css', function(resource) {
            var resourcePath = resource.path();
            var parser = new less.Parser({
                filename: resourcePath && resourcePath.absolute()
            });
            var parse = highland.wrapCallback(parser.parse.bind(parser));
            return parse(resource.data()).map(function(tree) {
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

                return resource.
                    withTransformation('minimised', 'min').
                    withData(data, sourceMap);
            });
        }));
    });
};
