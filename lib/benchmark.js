'use strict';

var _TypedNeuQuant = require('./TypedNeuQuant.js');

/*
typed 100 runs:
  run finished at q1
  avg: 661.46ms median: 660.54ms
  run finished at q10
  avg: 67.49ms median: 67.03ms
  run finished at q20
  avg: 34.56ms median: 34.19ms
normal 100 runs:
  run finished at q1
  avg: 888.10ms median: 887.63ms
  run finished at q10
  avg: 92.85ms median: 91.99ms
  run finished at q20
  avg: 46.14ms median: 45.68ms
*/

var quality = 10; // pixel sample interval, 1 being the best quality
var runs = 100;

if (__guard__(window.performance, function (x) {
  return x.now;
}) != null) {
  var now = function now() {
    return window.performance.now();
  };
} else {
  var now = Date.now;
}

window.addEventListener('load', function () {
  var img = document.getElementById('image');
  var canvas = document.getElementById('canvas');

  var w = canvas.width = img.width;
  var h = canvas.height = img.height;

  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  var imdata = ctx.getImageData(0, 0, img.width, img.height);
  var rgba = imdata.data;

  var rgb = new Uint8Array(w * h * 3);
  //rgb = new Array w * h * 3

  var rgb_idx = 0;
  var iterable = __range__(0, rgba.length, false);
  for (var j = 0; j < iterable.length; j += 4) {
    var i = iterable[j];
    rgb[rgb_idx++] = rgba[i + 0];
    rgb[rgb_idx++] = rgba[i + 1];
    rgb[rgb_idx++] = rgba[i + 2];
  }

  var runtimes = [];
  var iterable1 = __range__(0, runs, false);
  for (var k = 0; k < iterable1.length; k++) {
    var run = iterable1[k];
    var start = now();
    var imgq = new _TypedNeuQuant.NeuQuant(rgb, quality);
    imgq.buildColormap();
    var end = now();
    var delta = end - start;
    runtimes.push(delta);
  }

  console.log(runtimes.join('\n'));

  var map = imgq.getColormap();
  var avg = runtimes.reduce(function (p, n) {
    return p + n;
  }) / runtimes.length;
  var median = runtimes.sort()[Math.floor(runs / 2)];
  console.log('run finished at q' + quality + '\navg: ' + avg.toFixed(2) + 'ms median: ' + median.toFixed(2) + 'ms');

  var iterable2 = __range__(0, h, false);
  for (var i1 = 0; i1 < iterable2.length; i1++) {
    var y = iterable2[i1];
    var iterable3 = __range__(0, w, false);
    for (var j1 = 0; j1 < iterable3.length; j1++) {
      var x = iterable3[j1];
      var idx = (y * w + x) * 4;

      var r = rgba[idx + 0];
      var g = rgba[idx + 1];
      var b = rgba[idx + 2];

      var map_idx = imgq.lookupRGB(r, g, b) * 3;

      rgba[idx + 0] = map[map_idx];
      rgba[idx + 1] = map[map_idx + 1];
      rgba[idx + 2] = map[map_idx + 2];
    }
  }

  ctx.putImageData(imdata, 0, 0);

  return function () {
    var result = [];
    var iterable4 = __range__(0, map.length, false);
    for (var k1 = 0; k1 < iterable4.length; k1 += 3) {
      var _i = iterable4[k1];
      var color = [map[_i], map[_i + 1], map[_i + 2]];
      var el = document.createElement('span');
      el.style.display = 'inline-block';
      el.style.height = '1em';
      el.style.width = '1em';
      el.style.background = 'rgb(' + color.join(',') + ')';
      result.push(document.body.appendChild(el));
    }
    return result;
  }();
});

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  var range = [];
  var ascending = left < right;
  var end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (var i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}