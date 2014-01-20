var mapEachResource = require('plumber').mapEachResource;

var q = require('q');
var less = require('less');


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

            // FIXME: combine with existing sourcemap

            return resource.
                withData(stripSourceMappingComment(cssData)).
                withSourceMap(sourceMapData);
        });
    }));
};
