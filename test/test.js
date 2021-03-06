var chai = require('chai');
chai.should();

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var SourceMapGenerator = require('source-map').SourceMapGenerator;


var runAndCompleteWith = require('plumber-util-test').runAndCompleteWith;

var Resource = require('plumber').Resource;
var SourceMap = require('mercator').SourceMap;

var mincss = require('..');


function createResource(params) {
  return new Resource(params);
}

function resourcesError() {
  chai.assert(false, "error in resources observable");
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
    var data = ".foo {\n    color: white;\n}\n\n\n.bar  {\n    border: none;\n}";

    beforeEach(function() {
      resource = createResource({
        type: 'css',
        path: 'path/to/file.css',
        data: data
      });
    });

    it('should return the same CSS resource with a .min filename', function(done){
      runAndCompleteWith(mincss(), [resource], function(minimised) {
        minimised.length.should.equal(1);
        minimised[0].filename().should.equal('file.min.css');
      }, resourcesError, done);
    });

    it('should return the same CSS resource with contents minimised', function(done){
      runAndCompleteWith(mincss(), [resource], function(minimised) {
        minimised.length.should.equal(1);
        minimised[0].data().should.equal('.foo{color:white}.bar{border:none}');
      }, resourcesError, done);
    });

    it('should return a source map for the minimisation', function(done){
      runAndCompleteWith(mincss(), [resource], function(minimised) {
        var map = new SourceMapConsumer(minimised[0].sourceMap());
        map.sources.should.deep.equal(['path/to/file.css']);
        map.sourcesContent.should.deep.equal([data]);

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
      }, resourcesError, done);
    });

    it('should combine the existing source map with the one for the minimisation', function(done){
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

      var fooData = '.foo {\n    color: white;\n}\n';
      var barData = '.bar  {\n    border: none;\n}';
      generator.setSourceContent('foo.css', fooData);
      generator.setSourceContent('bar.css', barData);

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

      runAndCompleteWith(mincss(), [resourceWithSourceMap], function(minimised) {
        var map = new SourceMapConsumer(minimised[0].sourceMap());
        map.sources.should.deep.equal(['foo.css', 'bar.css']);
        map.sourcesContent.should.deep.equal([fooData, barData]);

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
      }, resourcesError, done);
    });

    it('should pass through non-CSS resources', function(done){
      var jsResources = [
        createResource({
          type: 'javascript',
          path: 'path/to/file.js',
          data: 'var x = 3;'
        })
      ];
      runAndCompleteWith(mincss(), jsResources, function(minimised) {
        minimised.should.deep.equal(jsResources);
      }, resourcesError, done);
    });
  });

});
