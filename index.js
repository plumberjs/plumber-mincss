var mapEachResource = require('plumber').mapEachResource;

var q = require('q');
var less = require('less');

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var SourceMapGenerator = require('source-map').SourceMapGenerator;

function remapSourceMap(originalMapData, sourceMapData, dest) {
    var originalMap = new SourceMapConsumer(originalMapData);
    var minimiseMap = new SourceMapConsumer(sourceMapData);

    var generator = new SourceMapGenerator({
        file: dest.filename()
    });

// FIXME: don't need this mapping?
//     // Rebase the mapping from the originalMap (if any)
//     originalMap.eachMapping(function(originalMapping) {
//         var generated = minimiseMap.generatedPositionFor({
//             line:   originalMapping.generatedLine,
//             column: originalMapping.generatedColumn,
//             source: dest.path().absolute()
//             // source: originalMapping.source
//         });
// console.log({
//     transitional: {
//             line:   originalMapping.generatedLine,
//             column: originalMapping.generatedColumn,
//             source: dest.path().absolute()
//     },
//             generated: {
//                 line:   generated.line,
//                 column: generated.column
//             },
//             original: {
//                 line:   originalMapping.originalLine,
//                 column: originalMapping.originalColumn
//             },
//             source: originalMapping.source
//         })
//         generator.addMapping({
//             generated: {
//                 line:   generated.line,
//                 column: generated.column
//             },
//             original: {
//                 line:   originalMapping.originalLine,
//                 column: originalMapping.originalColumn
//             },
//             source: originalMapping.source
//         });
//     });

    // Rebase the mapping from the originalMap (if any)
    minimiseMap.eachMapping(function(minimiseMapping) {
        var original = originalMap.originalPositionFor({
            line:   minimiseMapping.originalLine,
            column: minimiseMapping.originalColumn
        });
        generator.addMapping({
            generated: {
                line:   minimiseMapping.generatedLine,
                column: minimiseMapping.generatedColumn
            },
            original: {
                line:   original.line,
                column: original.column
            },
            source: original.source
        });
    });

    return generator.toString();
}

function stripSourceMappingComment(source) {
    return source.replace(/\/[*/][@#]\ssourceMappingURL[^\r\n]*/g, '');
}

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
                writeSourceMap: function writeSourceMap(data) {
                    // this whole pseudo async is somewhat ridiculous
                    sourceMapData = data;
                }
            });

            // If the source had a sourcemap, rebase the minimisation
            // sourcemap based on that original map
            var originalMapData = resource.sourceMap();
            if (originalMapData) {
                sourceMapData = remapSourceMap(originalMapData, sourceMapData, resource);
            }

            return resource.
                withData(stripSourceMappingComment(cssData)).
                withSourceMap(sourceMapData);
        });
    }));
};
