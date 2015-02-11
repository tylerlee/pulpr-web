var express = require('express');
var exphbs  = require('express-handlebars');
var app = express();
var bodyParser = require('body-parser');
var phantom = require('phantom');
var fs   = require('fs');
var marked = require('marked');
var htmlparser = require("htmlparser");
var _ = require('underscore');

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.set('view engine', 'handlebars');

// main index, allows you to drop in your file  
app.get('/', function (req, res) {
  res.render('home', {
    layout: 'app'
  });
});

// Post to /convert with your content so that we can
// let the magic happen
app.post('/convert', function (req, res) {
  var content = marked(req.body.content);
  var fileName = req.body.fileName;
  var meta = findMetaInfo(content);
  var savePath = 'tmp/' + fileName + '.handlebars';
  createTempFile(content, savePath, meta, req, fileName);

  res.render('download', {
    layout: 'app',
    fileName: fileName,
    fileLayout: meta.layout
  });
});

// take the html output by marked and drop it into the 
// layout that the file specifies. 
app.get('/generated/tmpFile', function (req, res) {
  res.render('../tmp/' + req.query.fileName, {
    layout: req.query.layout,
    title: req.query.title,
    content: fs.readFile('/tmp/'+req.query.fileName+'.handlebars', function(){})
  });
});

// send the file to the user
app.get('/download/tmpFile', function (req, res) {
  res.download('tmp/'+req.query.fileName+'.pdf');
});

var findMetaInfo = function (content) {
  var handler = new htmlparser.DefaultHandler(function (error, dom) {
    if (error){ console.log(error); }
  });
  
  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(content);
  
  var frontMatter = handler.dom[0].data;

  var defaults = {
    title: null,
    layout: 'skeleton',
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

var createTempFile = function (content, savePath, meta, req, fileName) {
  fs.writeFile(savePath, content, function(err) {
    if(err) {
      console.log(err);
    } else {
      renderPDF(meta, req, fileName);
    }
  });
}

var renderPDF = function (meta, req, fileName) {
  phantom.create(function (ph) {
    ph.createPage(function (page) {
      page.open(req.protocol + '://' + req.get('host') + '/generated/tmpFile?fileName=' + fileName + '&layout=' + meta.layoutPath + '&title=' + meta.title, function (status) {
        page.set('paperSize', {
          width: meta.pageWidth,
          height: meta.pageHeight,
          margin: meta.pageMargin
        });
        page.render('tmp/' + fileName + '.pdf');
      });
    });
  });
}


// Allow public directory to be used for static files
app.use(express.static(__dirname + '/public'));

// Start me up on 3000 locally, or wherever heroku wants
app.listen(process.env.PORT || 3000);

