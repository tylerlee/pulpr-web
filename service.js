var express = require('express'),
    exphbs  = require('express-handlebars');
 
var app = express(),
    bodyParser = require('body-parser'),
    fs   = require('fs'),
    htmlparser = require("htmlparser"),
    marked = require('marked'),
    phantom = require('phantom');    

var _ = require('underscore');

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));


var findMetaInfo = function (content) {
  var handler = new htmlparser.DefaultHandler(function (error, dom) {
    if (error){ console.log(error); }
  });
  
  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(content);
  
  var frontMatter = handler.dom[0].data;
  var defaults = {
    title: null,
    layout: 'basic',
    pageWidth: '8.5in',
    pageHeight: '11in',
    pageMargin: '.5in'
  }

  var file = {}

  _.each(defaults, function (value, key){
    var re = new RegExp(key + ': (.*)');
    var match = re.exec(frontMatter);
    file[key] = (match && match[1]) || value;
  });

  file['layoutPath'] = 'themes/' + file.layout;
  return file;
}

var createTempFile = function (content, savePath) {
  fs.writeFile(savePath, content, function(err) {
    if(err) {
      console.log(err);
    } else {
      console.log("The file was saved!");
    }
  });
}

var renderPDF = function (meta, options) {
  phantom.create(function (ph) {
    ph.createPage(function (page) {
      page.open('http://localhost:3000/generated/tmpFile?layout=' + meta.layoutPath + '&title=' + meta.title, function (status) {
        page.set('paperSize', {
          width: meta.pageWidth,
          height: meta.pageHeight,
          margin: meta.pageMargin
        });
        console.log('rendering');
        page.render('public/tmpFile.pdf');
      });
    });
  });
}

app.get('/', function (req, res) {
  res.render('home', { layout: 'app' });
});

app.get('/generated/tmpFile', function (req, res) {
  res.render('generated/tmpFile', {
    layout: req.query.layout,
    title: req.query.title
  });
});

app.post('/convert', function (req, res) {
  var savePath = 'views/generated/tmpFile.handlebars';
  var content = marked(req.body.content);
  var meta = findMetaInfo(content);
  createTempFile(content, savePath);
  renderPDF(meta);

  res.render('download', {
    layout: 'app',
    fileName: meta.title,
    fileLayout: meta.layout
  });
});

// GET /style.css etc
app.use(express.static(__dirname + '/public'));

app.listen(3000);