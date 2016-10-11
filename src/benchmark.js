import { NeuQuant } from './TypedNeuQuant.js';

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

let quality = 10; // pixel sample interval, 1 being the best quality
let runs = 100;

if (__guard__(window.performance, x => x.now) != null) {
  var now = () => window.performance.now();
} else {
  var { now } = Date;
}

window.addEventListener('load', function() {
  let img = document.getElementById('image');
  let canvas = document.getElementById('canvas');

  let w = canvas.width = img.width;
  let h = canvas.height = img.height;

  let ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  let imdata = ctx.getImageData(0, 0, img.width, img.height);
  let rgba = imdata.data;

  let rgb = new Uint8Array(w * h * 3);
  //rgb = new Array w * h * 3

  let rgb_idx = 0;
  let iterable = __range__(0, rgba.length, false);
  for (let j = 0; j < iterable.length; j += 4) {
    let i = iterable[j];
    rgb[rgb_idx++] = rgba[i + 0];
    rgb[rgb_idx++] = rgba[i + 1];
    rgb[rgb_idx++] = rgba[i + 2];
  }

  let runtimes = [];
  let iterable1 = __range__(0, runs, false);
  for (let k = 0; k < iterable1.length; k++) {
    let run = iterable1[k];
    let start = now();
    var imgq = new NeuQuant(rgb, quality);
    imgq.buildColormap();
    let end = now();
    let delta = end - start;
    runtimes.push(delta);
  }

  console.log(runtimes.join('\n'));

  let map = imgq.getColormap();
  let avg = runtimes.reduce((p, n) => p + n) / runtimes.length;
  let median = runtimes.sort()[Math.floor(runs / 2)];
  console.log(`run finished at q${ quality }
avg: ${ avg.toFixed(2) }ms median: ${ median.toFixed(2) }ms`
  );

  let iterable2 = __range__(0, h, false);
  for (let i1 = 0; i1 < iterable2.length; i1++) {
    let y = iterable2[i1];
    let iterable3 = __range__(0, w, false);
    for (let j1 = 0; j1 < iterable3.length; j1++) {
      let x = iterable3[j1];
      let idx = ((y * w) + x) * 4;

      let r = rgba[idx + 0];
      let g = rgba[idx + 1];
      let b = rgba[idx + 2];

      let map_idx = imgq.lookupRGB(r, g, b) * 3;

      rgba[idx + 0] = map[map_idx];
      rgba[idx + 1] = map[map_idx + 1];
      rgba[idx + 2] = map[map_idx + 2];
    }
  }

  ctx.putImageData(imdata, 0, 0);

  return (() => {
    let result = [];
    let iterable4 = __range__(0, map.length, false);
    for (let k1 = 0; k1 < iterable4.length; k1 += 3) {
      let i = iterable4[k1];
      let color = [map[i], map[i + 1], map[i + 2]];
      let el = document.createElement('span');
      el.style.display = 'inline-block';
      el.style.height = '1em';
      el.style.width = '1em';
      el.style.background = `rgb(${color.join(',')})`;
      result.push(document.body.appendChild(el));
    }
    return result;
  })();
}
);

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}