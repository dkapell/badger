var express = require('express');
var router = express.Router();
var permission = require('../lib/permission');
var auth = require('../lib/auth');
var _ = require('underscore');
var badge = require('../lib/badge');
var badgerHelper = require('../lib/badger-helper');
var async = require('async');

function search(req, res, next){
    var query = req.query.query;
    if (! query ){
        return res.json([]);
    }
    req.models.attendee.search(req.session.currentEvent.id, query, function(err, attendees){
        if (err) { return next(err); }
        res.json(attendees);
    });
}

function list(req, res, next){
    req.models.attendee.listByEvent(req.session.currentEvent.id, function(err, attendees){
        if (err) { return next(err); }
        if (req.originalUrl.match(/\/api\//)){
            res.json(attendees);
        } else {
            res.locals.attendees = attendees;
            res.render('attendees/list');
        }
    });
}

function listRegistered(req, res, next){
    req.models.attendee.listByEvent(req.session.currentEvent.id, function(err, attendees){
        if (err) { return next(err); }
        attendees = _.filter(attendees, function(attendee){
            return  (attendee.registered);
        })
        res.json(attendees)
    });
}

function get(req, res, next){
    var attendee_id = req.params.id;
    req.models.attendee.get(attendee_id, function(err, attendee){
        if (err) { return next(err); }
        if (req.originalUrl.match(/\/api\//)){
            res.json(attendee);
        } else {
            res.locals.attendee = attendee;
            req.getAudits('attendee', attendee_id, function(err, audits){
                if (err) { return next(err); }
                res.locals.audits = audits;
                res.render('attendees/show');
            });
        }
    });
}

function printBadge(req, res, next){
    var attendee_id = req.params.id;
    req.models.attendee.get(attendee_id, function(err, attendee){
        if (err) { return next(err); }
        badge.print(req.session.currentEvent.badge, attendee, function(err){
            if (err){ return next(err); }
            attendee.badged = true;
            req.models.attendee.update(attendee.id, attendee, function(err){
                if (err){ return next(err); }
                req.audit('badge', 'attendee', attendee_id);
                res.json({success:true});
            });
        });
    });
}

function showBadge(req, res, next){
    var attendee_id = req.params.id;
    req.models.attendee.get(attendee_id, function(err, attendee){
        if (err) { return next(err); }
        badge.print(req.session.currentEvent.badge, attendee, {display:true}, function(err, badge){
            if (err){ return next(err); }
            if (req.query.download){
                res.attachment(attendee.name + '.pdf');
            }
            res.set('Content-Type', 'application/pdf');
            res.send(badge);
        });
    });
}

function register(req, res, next){
    var attendee_id = req.params.id;
    req.models.attendee.get(attendee_id, function(err, attendee){
        if (err) { return next(err); }
        if (attendee.registered === true){
            return res.json({success:true});
        }
        attendee.registered = true;
        req.models.attendee.update(attendee.id, attendee, function(err){
            if (err){ return next(err); }
            req.audit('register', 'attendee', attendee_id);
            res.json({success:true});
        });
    });
}

function unregister(req, res, next){
    var attendee_id = req.params.id;
    req.models.attendee.get(attendee_id, function(err, attendee){
        if (err) { return next(err); }
        if (attendee.registered === false){
            return res.json({success:true});
        }
        attendee.registered = false;
        req.models.attendee.update(attendee.id, attendee, function(err){
            if (err){ return next(err); }
            req.audit('unregister', 'attendee', attendee_id);
            res.json({success:true});
        });
    });
}

function checkIn(req, res, next){
    var attendee_id = req.params.id;
    var attendeeData;
    async.waterfall([
        function(cb){
            req.models.attendee.get(attendee_id, cb);
        },
        function(attendee, cb){
            if (attendee_id.checked_in === true){
                if (req.originalUrl.match(/\/api\//)){
                    res.json({success:true});
                } else {
                    req.flash('success', attendeeData.name + ' is already checked in');
                    res.redirect('/attendees/' + attendee_id);
                }
             }
            attendee.checked_in = true;

            attendeeData = attendee;
            req.models.attendee.update(attendee_id, attendee, cb);
        },
        function(attendee, cb){
            req.audit('checkin', 'attendee', attendee_id, cb);
        },
        function(log_id, cb){
            console.log(req.query.badge);
            if (req.query.badge){
                async.series([
                    function(cb){
                        badge.print(req.session.currentEvent.badge, attendeeData, cb);
                    },
                    function(cb){
                        attendeeData.badged = true;
                        req.models.attendee.update(attendee_id, attendeeData, cb);
                    },
                    function(cb){
                        req.audit('badge', 'attendee', attendee_id, cb);
                    }
                ], cb);
            } else {
                process.nextTick(cb);
            }
        }
    ], function(err){
        if (err) { return next(err); }
        if (req.originalUrl.match(/\/api\//)){
            res.json({success:true});
        } else {
            if (req.query.badge){
                req.flash('success', 'Checked in and Badged '+ attendeeData.name);
                res.redirect('/');
            } else {
                req.flash('success', 'Checked in'+ attendeeData.name);
                res.redirect('/attendees' + attendee_id);
            }
        }
    });
}

function updateAttendee(req, res, next){
    var value = req.body.value;
    var parts = req.body.id.split('-');
    var id = parts[1];
    var field = parts[2];
    var fieldName = field;
    var datafield;

    if (field === 'data'){
        datafield = parts[3];
        fieldName = 'data.' + datafield;
    }
    var storeValue = value;
    if (field === 'registered' ||
        field === 'checked_in' ||
        field === 'badged' ||
        (field==='data' && req.session.currentEvent.importer.rules.attendee[datafield].type === 'boolean')){
        if (value === 'Yes'){
            storeValue = true;
        } else if (value === 'No'){
            storeValue = false;
        }
    }

    req.models.attendee.get(id, function(err, attendee){
        if (err) { return next(err); }
        var oldValue = null;
        if (field === 'data'){
            oldValue = attendee.data[datafield];
            if (oldValue === storeValue){
                return res.status(200).send(value.toString());
            }
            attendee.data[datafield] = storeValue;
        } else {
            oldValue = attendee[field];
            if (oldValue === storeValue){
                return res.status(200).send(value.toString());
            }
            attendee[field] = storeValue;
        }
        req.models.attendee.update(id, attendee, function(err){
            if (err) { return next(err); }
            req.audit('update', 'attendee', id, {field: fieldName, old: oldValue, new: storeValue});
            res.status(200).send(value.toString());
        });
    });
}

router.use(auth.basicAuth);
router.use(permission('access'));
router.use(badgerHelper.setSection('attendees'));

router.get('/search', search);
router.get('/', list);
router.get('/listRegistered', listRegistered);

router.get('/:id', get);
router.get('/:id/showBadge', showBadge);

router.post('/:id/badge', printBadge);
router.post('/:id/checkin', checkIn);
router.post('/:id/register', register);
router.post('/:id/unregister', unregister);

router.post('/', updateAttendee);

module.exports = router;