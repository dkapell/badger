'use strict';
var PDFDocument = require('pdfkit');
var _ = require('underscore');
var PrintStream = require('../lib/PrintStream');
var config = require('config');

exports.getPageSize = function(media){
    return getPage(media);
}

/*
 * print a badge
 * print(positions, data, <options>, <callback>)
 */
exports.print = function(){

    var positions = arguments[0];
    var data = arguments[1];
    var options = {};
    var cb = function(){};

    if (typeof arguments[arguments.length-1] === 'function'){
        cb = arguments[arguments.length-1];
    }

    if (arguments.length > 2 && typeof arguments[2] === 'object'){
        options = arguments[2];
    }
    var media = config.get('pages.default');
    var page = getPage(options.media)

    var printer = options.printer || config.get('app.printer');

    var doc = new PDFDocument({
        size: [ page.width, page.height ],
        margins: {
            top: page.margin,
            bottom: page.margin,
            left: page.margin,
            right: page.margin,
        }
    });

    var jobName = _.has(data, 'name') ? 'Badge for ' + data.name : config.get('app.name') + ' Job';
    var fileName = config.get('app.outputDir') + '/';
    fileName += _.has(data, 'id') ? data.id + '.pdf': 'badge.pdf';

    var output = new PrintStream({
        printer: printer,
        type: 'PDF',
        jobName: jobName,
        print: config.get('app.print'),
        file: fileName,
    }, cb);

    doc.pipe(output);

    positions.forEach(function(position){
        addElement(doc, position, data, page);
    });

    doc.end();
}

function getPage(media){
    if (! _.has(config.pages.sizes, media)){
        media =  config.get('pages.default');
    }
    var ppi = config.get('pages.ppi');
    var mediaLayout = config.get('pages.sizes.' + media);
    var page = {
        width: mediaLayout.width * ppi,
        height: mediaLayout.height * ppi,
        margin: mediaLayout.margin * ppi,
    };
    return page;
}

function addElement(doc, position, data, page){
    var item = position.name;

    if (!_.has(data.badgeData, item)){
        return;
    }
    var size = 12;

    var x = position.x;
    var y = position.y;
    var width = page.width - (2*page.margin);
    var align = 'center';

    if (position.size){
        size = position.size;
    }
    if (position.align){
        align = position.align;
    }
    if (position.width){
        width = position.width;
    }

    if (x === 'center'){ x = page.margin; }
    if (x === 'margin'){ x = page.margin; }
    if (y === 'center'){ y = (page.height/2) - size; }
    if (y === 'margin'){ y = page.margin; }
    if (y === '-margin'){ y = page.height - (page.margin + size*1.20); }

    config.get('app.debug') && console.log(JSON.stringify({
        text: data.badgeData[item],
        x:x,
        y:y,
        width:width,
        size: size
    }, null ,2));

    var options = {
        align: align,
        width: width
    }
    if (_.has(position.pdfOptions)){
        for (key in position.pdfOptions){
            options.key = position.pdfOptions[key];
        }
    }

    if (position.font){
        doc.font(position.font);
    } else {
        doc.font(config.get('app.defaultFont'));
    }

    doc.fontSize(size);
    doc.text(data.badgeData[item], x, y, options);
}
