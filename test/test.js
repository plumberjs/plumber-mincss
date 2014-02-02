var chai = require('chai');
chai.should();
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

require('mocha-as-promised')();

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var SourceMapGenerator = require('source-map').SourceMapGenerator;


var Resource = require('plumber').Resource;
var SourceMap = require('mercator').SourceMap;

var mincss = require('..');


function createResource(params) {
  return new Resource(params);
}

describe('mincss', function(){
  it('should be a function', function(){
    mincss.should.be.a('function');
  });

  it('should return a function', function(){
    mincss().should.be.a('function');
  });


  describe('#apply', function() {
    var resource;
    beforeEach(function() {
      resource = createResource({
        type: 'css',
        path: 'path/to/file.css',
        data: ".foo {\n    color: white;\n}\n\n\n.bar  {\n    border: none;\n}"
      });
    });

    it('should return the same CSS resource with contents minimised', function(){
      var minimisedResources = mincss()([resource]);
      return minimisedResources.then(function(minimised) {
        minimised.length.should.equal(1);
        minimised[0].data().should.equal('.foo{color:white}.bar{border:none}');
      });
    });

    it('should return a source map for the minimisation', function(){
      var minimisedResources = mincss()([resource]);
      return minimisedResources.then(function(minimised) {
        var map = new SourceMapConsumer(minimised[0].sourceMap());
        map.sources.should.deep.equal(['path/to/file.css']);
        // .foo{color:white}.bar{border:none}
        // ^
        map.originalPositionFor({line: 1, column: 0}).should.deep.equal({
          source: 'path/to/file.css',
          line: 1,
          column: 0,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //      ^
        map.originalPositionFor({line: 1, column: 5}).should.deep.equal({
          source: 'path/to/file.css',
          line: 2,
          column: 4,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //        ^
        map.originalPositionFor({line: 1, column: 7}).should.deep.equal({
          source: 'path/to/file.css',
          line: 2,
          column: 4, // FIXME: why not 5?
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //                  ^
        map.originalPositionFor({line: 1, column: 17}).should.deep.equal({
          source: 'path/to/file.css',
          line: 6,
          column: 0,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //                       ^
        map.originalPositionFor({line: 1, column: 22}).should.deep.equal({
          source: 'path/to/file.css',
          line: 7,
          column: 4,
          name: null
        });
      });
    });

    it('should combine the existing source map with the one for the minimisation', function(){
      var generator = new SourceMapGenerator({
        file: 'file.css'
      });

      var i;
      for (i = 1; i <= 3; i++) {
        generator.addMapping({
          generated: { line: i,  column: 0 },
          original:  { line: i,  column: 0 },
          source: 'foo.css'
        });
      }
      // Why do we need to add this?
      generator.addMapping({
        generated: { line: 2,  column: 4 },
        original:  { line: 2,  column: 4 },
        source: 'foo.css'
      });
      var barOffset = 5;
      for (i = 1; i <= 3; i++) {
        generator.addMapping({
          generated: { line: i + barOffset,  column: 0 },
          original:  { line: i,              column: 0 },
          source: 'bar.css'
        });
      }

      var originalSourceMap = SourceMap.fromMapData(generator.toString());

      var resourceWithSourceMap = createResource({
        type: 'css',
        path: 'path/to/file.css',
        /*
         ==
       1 .foo {
       2     color: white;
       3 }
       4
       5
       6 .bar  {
       7     border: none;
       8 }
         */
        data: ".foo {\n    color: white;\n}\n\n\n.bar  {\n    border: none;\n}",
        sourceMap: originalSourceMap
      });
      var minimisedResources = mincss()([resourceWithSourceMap]);
      return minimisedResources.then(function(minimised) {
        var map = new SourceMapConsumer(minimised[0].sourceMap());
        map.sources.should.deep.equal(['foo.css', 'bar.css']);
        // .foo{color:white}.bar{border:none}
        // ^
        map.originalPositionFor({line: 1, column: 0}).should.deep.equal({
          source: 'foo.css',
          line: 1,
          column: 0,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //      ^
        map.originalPositionFor({line: 1, column: 5}).should.deep.equal({
          source: 'foo.css',
          line: 2,
          column: 4,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //       ^
        map.originalPositionFor({line: 1, column: 6}).should.deep.equal({
          source: 'foo.css',
          line: 2,
          column: 4, // FIXME: why not 5?
          name: null
        });
        // FIXME: closing brace not mapped correctly?
        // .foo{color:white}.bar{border:none}
        //                 ^
        // map.originalPositionFor({line: 1, column: 16}).should.deep.equal({
        //   source: 'foo.css',
        //   line: 3,
        //   column: 0,
        //   name: null
        // });
        // .foo{color:white}.bar{border:none}
        //                  ^
        map.originalPositionFor({line: 1, column: 17}).should.deep.equal({
          source: 'bar.css',
          line: 1,
          column: 0,
          name: null
        });
        // .foo{color:white}.bar{border:none}
        //                       ^
        map.originalPositionFor({line: 1, column: 22}).should.deep.equal({
          source: 'bar.css',
          line: 2,
          column: 0, // FIXME: why not 4?
          name: null
        });
      });
    });

    it('should pass through non-CSS resources', function(){
      var jsResources = [
        createResource({
          type: 'javascript',
          path: 'path/to/file.js',
          data: 'var x = 3;'
        })
      ];
      var minimisedResources = mincss()(jsResources);
      return minimisedResources.should.eventually.deep.equal(jsResources);
    });
  });

});
