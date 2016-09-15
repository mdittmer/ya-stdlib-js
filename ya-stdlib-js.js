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
  define(function() {
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
      future: function future() {
        var value;
        var isSet;

        isSet = false;
        function f(f2) {
          if (isSet) f2(value);
          else f.waiters.push(f2);
          return f;
        }
        f.waiters = [];
        f.get = f;
        f.set = function set(v) {
          var i;
          value = v;
          isSet = true;
          for (i = 0; i < f.waiters.length; i++) {
            f.waiters[i](v);
          }
          isSet = false;
          f.waiters = [];
        };
        return f;
      },
      // Fetch URLs. Return a future that resolves after all URLs are fetched.
      loadData: function getData(urls_, opts) {
        var urls = Array.isArray(urls_) ? urls_ : [urls_];
        var future;
        var len;
        var data;
        var count;
        var i;
        var url;
        var xhr;

        opts = opts || {};

        future = stdlib.future();
        len = urls.length;
        data = new Array(len);
        count = 0;
        function store(i) {
          data[i] = this.response;
          count++;
          if (count === len)
            future.set(Array.isArray(urls_) ? data : data[0]);
        }
        for (i = 0; i < len; i++) {
          url = urls[i];
          xhr = new XMLHttpRequest();
          if (opts.responseType)
            xhr.responseType = opts.responseType;
          xhr.addEventListener('load', store.bind(xhr, i));
          xhr.open('GET', url);
          xhr.send();
        }
        return future;
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
