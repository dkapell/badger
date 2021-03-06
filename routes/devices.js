var express = require('express');
var async = require('async');
var _ = require('underscore');
var csurf = require('csurf');

var router = express.Router();
var auth = require('../lib/auth');
var permission = require('../lib/permission');
var badgerHelper = require('../lib/badger-helper');

var printerHelper = require('../lib/printer-helper');


function list(req, res, next){
    if (req.originalUrl.match(/\/api\//)){
        res.json(printerHelper.list());
    } else {
        var deviceList = printerHelper.list();
        async.map(deviceList, function(device, cb){
            req.models.device.getByName(device.name, function(err, data){
                if (err) { return cb(err); }
                device.active = data.active;
                device.enabled = data.enabled;
                cb(null, device);
            });
        }, function(err){
            if (err) { return next(err); }
            res.locals.devices = deviceList;
            res.render('devices/list');
        });
    }
}

function clearQueue(req, res, next){
    var printerName = req.params.name;
    printerHelper.cancelJobs(printerName, function(err){
        if (err) { return next(err); }
        printerHelper.getJobs(printerName, function(err, jobs){
            if (err) { return next(err); }
            res.json(jobs);
        });
    });
}

function activate(req, res, next){
    var printerName = req.params.name;
    req.models.device.getByName(printerName, function(err, printer){
        if (err) { return next(err); }
        if (!printer){
            return next ('No Printer Found');
        }
        printer.active = true;
        req.models.device.update(printer.id, printer, function(err){
            if (err) { return next(err); }
            res.json({success:true});
        });
    });
}

function deactivate(req, res, next){
    var printerName = req.params.name;
    req.models.device.getByName(printerName, function(err, printer){
        if (err) { return next(err); }
        if (!printer){
            return next ('No Printer Found');
        }
        printer.active = false;
        req.models.device.update(printer.id, printer, function(err){
            if (err) { return next(err); }
            res.json({success:true});
        });
    });
}

function enable(req, res, next){
    var printerName = req.params.name;
    req.models.device.getByName(printerName, function(err, printer){
        if (err) { return next(err); }
        if (!printer){
            return next ('No Printer Found');
        }
        printer.enabled = true;
        req.models.device.update(printer.id, printer, function(err){
            if (err) { return next(err); }
            res.json({success:true});
        });
    });
}

function disable(req, res, next){
    var printerName = req.params.name;
    req.models.device.getByName(printerName, function(err, printer){
        if (err) { return next(err); }
        if (!printer){
            return next ('No Printer Found');
        }
        printer.active = false;
        printer.enabled = false;
        req.models.device.update(printer.id, printer, function(err){
            if (err) { return next(err); }
            res.json({success:true});
        });
    });
}


router.use(auth.basicAuth);
router.use(permission('access'));

router.get('/', list);
router.put('/:name/clear', clearQueue);
router.put('/:name/activate', activate);
router.put('/:name/deactivate', deactivate);
router.put('/:name/enable', permission('admin'), enable);
router.put('/:name/disable', permission('admin'), disable);


module.exports = router;
