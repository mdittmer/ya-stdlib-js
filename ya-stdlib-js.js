/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function(define) {
  define([ 'es6-promise' ], function(es6Promise) {
    var Promise = typeof Promise === 'undefined' ?
          es6Promise.Promise : Promise;

    var loadURL = typeof XMLHttpRequest === 'undefined' ?
          // Node JS:
          (function() {
            var urlParse = require('url').parse;
            var httpRequest = require('http').request;
            return function(url, opts) {
              var str = '';
              return new Promise(function(resolve, reject) {
                httpRequest(urlParse(url), function(response) {
                  var str = '';
                  response.on('data', function (chunk) { str += chunk; });
                  response.on('end', function () {
                    if (opts.responseType === 'json')
                      resolve(JSON.parse(str));
                    else
                      resolve(str);
                  });
                  response.on('error', function (e) { reject(e); });
                }).end();
              });
            };
          })() :
        // Browser:
        function(url, opts) {
          var xhr = new XMLHttpRequest();
          if (opts.responseType)
            xhr.responseType = opts.responseType;

          return new Promise(function(resolve, reject) {
            xhr.addEventListener('load', resolve);
            xhr.addEventListener('error', reject);
            xhr.open('GET', url);
            xhr.send();
          });
        };

    var stdlib = {
      argsToArray: (function() {
        if (typeof Array.from === 'function')
          return Array.from.bind(Array);
        return function argsToArray(args) {
          var array = new Array(args.length);
          var i;

          for (i = 0; i < args.length; i++) array[i] = args[i];
          return array;
        };
      })(),
      mapMap: function mapMap(srcMap, mapFn) {
        var dstMap = {};
        var keys;
        var i;

        keys = Object.getOwnPropertyNames(srcMap);
        for (i = 0; i < keys.length; i++) {
          dstMap[keys[i]] = mapFn(srcMap[keys[i]]);
        }
        return dstMap;
      },
      multiline: function multiline(f) {
        var match = f.toString().match(/\/\*((.|\n)*?)\*\//);
        if (!match) return '';
        // Within multiline comment, map "*\/" to "*/".
        return match[1].replace(/\*\\\//g, '*/');
      },
      toString: function toString(value) {
        if (value === null) return null;
        if (value === undefined) return undefined;
        if (typeof value === 'string') return '"' + value + '"';
        // TODO: Do all relevant platforms support Array.isArray?
        if (Array.isArray(value)) return '[' + value.map(function(item) {
          return stdlib.toString(item);
        }).join(', ') + ']';
        return value.toString.apply(value,
            stdlib.argsToArray(arguments).slice(1));
      },
      getArgNames: function getArgNames(f) {
        return Function.prototype.toString.call(f).replace(
            /\/\/.*|\/\*(.|\n)*?\*\//g,
            '').match(/\((([^)]|\n)*)\)/)[1].replace(
                /\s+/g, '').split(',').filter(function(name) {
                  return Boolean(name);
                }
            );
      },
      // Fetch URLs. Return a future that resolves after all URLs are fetched.
      loadData: function getData(urls_, opts) {
        var urls = Array.isArray(urls_) ? urls_ : [urls_];

        return Promise.all(urls.map(function(url) {
          return loadURL(url, opts);
        }));
      },
      memo: function memo(o, key, f) {
        var value;
        var computed;

        computed = false;
        Object.defineProperty(o, key, {
          get: function() {
            if (computed) return value;
            value = f();
            computed = true;
            return value;
          },
          configurable: true,
        });
      },
    };
    return stdlib;
  });
})((function() {
  if (typeof module !== 'undefined' && module.exports) {
    return function(deps, factory) {
      if (factory)
        module.exports = factory.apply(this, deps.map(require));
      else
        module.exports = deps();
    };
  } else if (typeof define === 'function' && define.amd) {
    return define;
  } else if (typeof window !== 'undefined') {
    return function(deps, factory) {
      if (document.currentScript === undefined ||
          document.currentScript === null)
        throw new Error('Unknown module name');

      window[
        document.currentScript.getAttribute('src').split('/').pop().split('#')[
          0].split('?')[0].split('.')[0]
      ] = (factory || deps).apply(this, factory ? deps.map(function(name) {
        return window[name];
      }) : []);
    };
  }
  throw new Error('Unknown environment');
})());
