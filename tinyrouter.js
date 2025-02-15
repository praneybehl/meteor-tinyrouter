import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import PathToRegexp from 'path-to-regexp';


export const Router = {
    _routes: [],
    _nameMap: {},

    debug: false,
    template: ReactiveVar(),
    params: ReactiveVar({params: {}}),
    notFoundTemplate: 'not_found',

    init() {
        this.log('initializing');
        this.handleClicks();
        this.load(window.location.pathname);
    },

    /**
     * Register a new route.
     *
     * @path - The URL route to listen for
     * @name - The name of the route for template lookups. Also 
     * used as the template name to be loaded if a callback isn't specified.
     * @callback - An *optional* callback for handling advanced route logic.
     */
    route(path, name, callback) {
        this.log('adding route:', path);
        var index = this._routes.length;
        var keys = [];
        var re = PathToRegexp(path, keys);

        this._routes.push({
            path: path,
            name: name,
            re: re,
            keys: keys,
            reverse: PathToRegexp.compile(path),
            callback: typeof callback === 'function' ? callback : function() {
                return this.render(name);
            }
        });

        this._nameMap[name] = index;
    },

    /**
     * Take the keys and result from PathToRegexp exec and returns an object
     * of named param values.
     */
    buildParams(keys, result) {
        var params = {}
        for(var i = 0; i < keys.length; i++) {
            var name = keys[i].name;
            var value = result[i+1];
            params[name] = value;
        }
        return params;
    },

    /**
     * Redirect to named path, adding any params if needed.
     */
    redirect(name, params) {
        path = this.reverse(name, params);
        this.log('redirecting to:', path);
        this.load(path);
    },

    /**
     * Convert a route name and its params to an actual path.
     */
    reverse(name, params) {
        const route = this._routes[this._nameMap[name]];

        for(let i = 0; i < route.keys.length; i++) {
            const key = route.keys[i]['name'];
            if (params[key] === undefined) {
                this.error('cant build url, missing param "'+key+'" for route "'+name+'"');
                return;
            }
        }

        if (route) {
            return route.reverse(params);
        } else {
            this.error('cant build url for "'+name+'", route doesnt exist');
        }
    },

    /**
     * Search routes for a match with the given path and call its callback.
     *
     * If no match is found, load `not_found` template.
     */
    load(path) {
        this.log('loading path:', path);

        if (window.location.pathname !== path) {
            history.pushState(null, null, path);
        }

        for (let i = 0; i < this._routes.length; i++) {
            const route = this._routes[i];
            this.log('comparing route:', route.path);
            const result = route.re.exec(path); 

            if (result) {
                const params = this.buildParams(route.keys, result);
                this.params.set({params: params});
                // this.currentParams = params;
                this.currentRoute = route;
                return route.callback.call(this, params);
            }
        }

        // If we got this far,  no route was found - set template to not found
        // this.currentTemplate.set(template);
        return this.render(this.notFoundTemplate);
    },

    render(template) {
        this.log('rendering template:', template);
        this.template.set(template);
    },

    handleClicks() {
        var self = this;
        $(document).ready(function() {
            $('a').click(function(e) {
                let href = e.target.href
                let path = e.target.pathname;

                if (href.startsWith(Meteor.absoluteUrl())) {
                    e.preventDefault();
                    self.load(path);
                }
            });
        });
    },

    log() {
        if (this.debug) {
            var args = Array.from(arguments);
            args.unshift('[TinyRouter]')
            console.log.apply(console, args);
        }
    },

    error() {
        var args = Array.from(arguments);
        args.unshift('[TinyRouter] ERROR:')
        console.log.apply(console, args);
    }
}


Template.registerHelper('routerTemplate', function() {
    return Router.template.get();
});


Template.registerHelper('routerData', function() {
    return Router.params.get();
});


Template.registerHelper('urlFor', function(name, params) {
    return Router.reverse(name, params.hash);
});


Meteor.startup(function() {
    Router.init();
});
