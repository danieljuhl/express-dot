var fs = require('fs');
var path = require('path');
var doT = require('dot');
var async = require('async');
var path = require('path');

var _cache = {},
	_partialsCache = {},
	_partialsCompiled = {};

var _globals = {
	load: function(file) {
		var template = '';
		// let's try loading content from cache
		if (doT.templateSettings.partialCache === true)
			template = _partialsCache[file] || '';

		// no content so let's load from file system 
		if (!template){
			try {
				template = fs.readFileSync(path.join(path.dirname(process.argv[1]), (doT.templateSettings.partialPath || '.'), file + (doT.templateSettings.partialExt || '')));
			}
			catch(e){ console.error(e); }
		}

		// let's cache the partial  
		if (doT.templateSettings.partialCache === true)
			_partialsCache[file] = template;

		return template;
	}
};

function _compilePartial(filename){
	var template = _partialsCompiled[filename];

	if (!template) {
		var tpl = _globals.load(filename);

		template = doT.template(tpl, null, _globals);

		if (doT.templateSettings.partialCache)
			_partialsCompiled[filename] = template;
	}

	return template;
}

function _renderPartial(filename, it){
	return _compilePartial(filename).call(_globals, it || {});
}

function _renderFile(filename, options, cb) {
	'use strict';
	cb = (typeof cb === 'function') ? cb : function() {};

	var template = _cache[filename];
	if (template) {
		try { return cb(null, template.call(_globals, options)); }
		catch(e) { return cb(e); }
	}

	return fs.readFile(filename, 'utf8', function(err, str) {
		if (err) return cb(err);

		var template = doT.template(str, null, _globals);
		if (options.cache) _cache[filename] = template;

		try { return cb(null, template.call(_globals, options)); }
		catch(e) { return cb(e); }
	});
}

function _renderWithLayout(filename, layoutTemplate, options, cb) {
	'use strict';
	cb = (typeof cb === 'function') ? cb : function() {};

	return _renderFile(filename, options, function(err, str) {
		if (err) return cb(err);
		options.body = str;
		return cb(null, layoutTemplate.call(_globals, options));
	});
}

exports.setGlobals = function(globals) {
	'use strict';
	for(var f in _globals){
		if(globals[f] === undefined){
			globals[f] = _globals[f];
		}
		else {
			throw new Error("Your global uses reserved utility: " + f);
		}
	}
	_globals = globals;
};

exports.setTemplateSettings = function(settings) {
	for (var i in settings) {
	//	if (doT.templateSettings[i] !== undefined) {
			doT.templateSettings[i] = settings[i];
	//	}
	}
};


exports.renderPartial = _renderPartial;

exports.__express = function(filename, options, cb) {
	'use strict';
	cb = (typeof cb === 'function') ? cb : function() {};
	var extension = path.extname(filename);

	if (options.layout !== undefined && !options.layout) return _renderFile(filename, options, cb);

	var viewDir = options.settings.views;
	var layoutFileName = path.join(viewDir, options.layout || 'layout' + extension);

	var layoutTemplate = _cache[layoutFileName];
	if (layoutTemplate) return _renderWithLayout(filename, layoutTemplate, options, cb);

	return fs.readFile(layoutFileName, 'utf8', function(err, str) {
		if (err) return cb(err);

		var layoutTemplate = doT.template(str, null, _globals);
		if (options.cache) _cache[layoutFileName] = layoutTemplate;

		return _renderWithLayout(filename, layoutTemplate, options, cb);
	});
};
