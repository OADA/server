'use strict';

var Promise = require('bluebird');
const mock = require('mock-require');

var resources = {};

before(function mockDb() {
    mock('oada-lib-arangodb', {
        resources: {
            getResource: function mockGetResource(id, path) {
                path = (path || '').split('/').filter(x => !!x);
                return Promise.try(function() {
                    var res = resources[id];

                    path.forEach(function(part) {
                        res = res[part];
                    });

                    return {next: () => res};
                });
            },

            setResource: function mockSetResource(id, path, val) {
                return Promise.try(function() {
                    if (path) {
                        path = path.split('/').filter(x => !!x);
                        var res = resources[id];

                        path.slice(0, -1).forEach(function(part) {
                            res = res[part];
                        });

                        res[path.pop()] = val;
                    } else {
                        resources[id] = val;
                    }
                });
            }
        }
    });
});
