var chai = require('chai');
chai.should();
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

require('mocha-as-promised')();

var SourceMapConsumer = require('source-map').SourceMapConsumer;


var Resource = require('plumber').Resource;

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
        map.originalPositionFor({line: 1, column: 0}).should.deep.equal({
          source: 'path/to/file.css',
          line: 1,
          column: 0,
          name: null
        });
        map.originalPositionFor({line: 1, column: 5}).should.deep.equal({
          source: 'path/to/file.css',
          line: 2,
          column: 4,
          name: null
        });
        map.originalPositionFor({line: 1, column: 7}).should.deep.equal({
          source: 'path/to/file.css',
          line: 2,
          column: 4, // why?
          name: null
        });
        map.originalPositionFor({line: 1, column: 17}).should.deep.equal({
          source: 'path/to/file.css',
          line: 6,
          column: 0,
          name: null
        });
      });
    });

    it('should combine the existing source map with the one for the minimisation', function(){
      // TODO
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
