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

var request = require('hyperquest');
var wait = require('event-stream').wait;

var decoder = typeof TextDecoder === 'undefined' ?
      new (require('text-encoding').TextDecoder)('utf-8') :
      new TextDecoder('utf-8');

var stdlib = {
  remap: {
    '[]=>{}': function(arr) {
      var map = {};
      for (var i = 0; i < arr.length; i++) {
        map[arr[i]] = 1;
      }
      return map;
    },
    // { a: { b }, c: { d }, e: { b } }
    // =>
    // { b: [a, e], d: [c] }
    'a:b=>b:[a]': function(map) {
      var newMap = {};
      var keys = Object.getOwnPropertyNames(map);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var arr = newMap[map[key]] = newMap[map[key]] || [];
        arr.push(key);
      }
      return newMap;
    },
    // { a: { b: c }, d: { b: c }, e: { b: f } }
    // =>
    // { c: { b: [a, d] }, f: { b: [e] } }
    'a:b:c=>c:b:[a]': function(map) {
      var newMap = {};
      var keys1 = Object.getOwnPropertyNames(map);
      for (var i = 0; i < keys1.length; i++) {
        var key1 = keys1[i];
        var keys2 = Object.getOwnPropertyNames(map[key1]);
        for (var j = 0; j < keys2.length; j++) {
          var key2 = keys2[j];
          var inner1 = newMap[map[key1][key2]] = newMap[map[key1][key2]] || {};
          var inner2 = inner1[key2] = inner1[key2] || [];
          inner2.push(key1);
        }
      }
      return newMap;
    },
    // { a: { b: c }, d: { b: c }, e: { f: g } }
    // =>
    // { b: [ [a, c], [d, c]], f: [ [e, g] ] }
    'a:b:c=>b:[(a,c)]': function(map) {
      var newMap = {};
      var keys1 = Object.getOwnPropertyNames(map);
      for (var i = 0; i < keys1.length; i++) {
        var key1 = keys1[i];
        var keys2 = Object.getOwnPropertyNames(map[key1]);
        for (var j = 0; j < keys2.length; j++) {
          var key2 = keys2[j];
          if (!newMap[key2]) newMap[key2] = [];
          newMap[key2].push([key1, map[key1][key2]]);
        }
      }
      return newMap;
    },
  },
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
      return new Promise(function(resolve, reject) {
        opts.uri = url;
        request(opts).pipe(wait(function(err, data) {
          if (err) reject(err);
          else resolve(decoder.decode(data));
        }));
      });
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

module.exports = stdlib;
