import EventEmitter from 'wolfy87-eventemitter';
import browser from './browser';

const defaults = {
  workers: 2,
  repeat: 0, // repeat forever, -1 = repeat once
  background: '#fff',
  quality: 10, // pixel sample interval, lower is better
  width: null, // size derermined from first frame if possible
  height: null,
  transparent: null
};

const frameDefaults = {
  delay: 500, // ms
  copy: false
};

class GIF extends EventEmitter {

  constructor(options) {
    super()
    this.running = false;

    this.options = {};
    this.frames = [];

    this.freeWorkers = [];
    this.activeWorkers = [];

    this.setOptions(options);
    for (let key in defaults) {
      let value = defaults[key];
      if (this.options[key] == null) { this.options[key] = value; }
    }

    if (!options.worker) {
      throw new Error('No worker specified');
    }
  }

  setOption(key, value) {
    this.options[key] = value;
    if (this._canvas != null && (key === 'width' || key === 'height')) {
      return this._canvas[key] = value;
    }
  }

  setOptions(options) {
    return (() => {
      let result = [];
      for (let key of Object.keys(options)) {
        let value = options[key];
        result.push(this.setOption(key, value));
      }
      return result;
    })();
  }

  addFrame(image, options={}) {
    let frame = {};
    frame.transparent = this.options.transparent;
    for (let key in frameDefaults) {
      frame[key] = options[key] || frameDefaults[key];
    }

    // use the images width and height for options unless already set
    if (this.options.width == null) { this.setOption('width', image.width); }
    if (this.options.height == null) { this.setOption('height', image.height); }

    if ((typeof ImageData !== 'undefined' && ImageData !== null) && image instanceof ImageData) {
       frame.data = image.data;
    } else if (((typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D !== null) && image instanceof CanvasRenderingContext2D) || ((typeof WebGLRenderingContext !== 'undefined' && WebGLRenderingContext !== null) && image instanceof WebGLRenderingContext)) {
      if (options.copy) {
        frame.data = this.getContextData(image);
      } else {
        frame.context = image;
      }
    } else if (image.childNodes != null) {
      if (options.copy) {
        frame.data = this.getImageData(image);
      } else {
        frame.image = image;
      }
    } else {
      throw new Error('Invalid image');
    }

    return this.frames.push(frame);
  }

  render() {
    if (this.running) { throw new Error('Already running'); }

    if ((this.options.width == null) || (this.options.height == null)) {
      throw new Error('Width and height must be set prior to rendering');
    }

    this.running = true;
    this.nextFrame = 0;
    this.finishedFrames = 0;

    this.imageParts = (__range__(0, this.frames.length, false).map((i) => null));
    let numWorkers = this.spawnWorkers();
    let iterable = __range__(0, numWorkers, false);
    for (let j = 0; j < iterable.length; j++) { let i = iterable[j]; this.renderNextFrame(); }

    this.emit('start');
    return this.emit('progress', 0);
  }

  abort() {
    while (true) {
      let worker = this.activeWorkers.shift();
      if (worker == null) { break; }
      console.log("killing active worker");
      worker.terminate();
    }
    this.running = false;
    return this.emit('abort');
  }

  // private

  spawnWorkers() {
    let numWorkers = Math.min(this.options.workers, this.frames.length);
    __range__(this.freeWorkers.length, numWorkers, false).forEach(i => {
      console.log(`spawning worker ${ i }`);
      let worker = new this.options.worker();
      worker.onmessage = event => {
        this.activeWorkers.splice(this.activeWorkers.indexOf(worker), 1);
        this.freeWorkers.push(worker);
        return this.frameFinished(event.data);
      };
      return this.freeWorkers.push(worker);
    }
    );
    return numWorkers;
  }

  frameFinished(frame) {
    console.log(`frame ${ frame.index } finished - ${ this.activeWorkers.length } active`);
    this.finishedFrames++;
    this.emit('progress', this.finishedFrames / this.frames.length);
    this.imageParts[frame.index] = frame;
    if (__in__(null, this.imageParts)) {
      return this.renderNextFrame();
    } else {
      return this.finishRendering();
    }
  }

  finishRendering() {
    let len = 0;
    for (let j = 0; j < this.imageParts.length; j++) {
      var frame = this.imageParts[j];
      len += ((frame.data.length - 1) * frame.pageSize) + frame.cursor;
    }
    len += frame.pageSize - frame.cursor;
    console.log(`rendering finished - filesize ${ Math.round(len / 1000) }kb`);
    let data = new Uint8Array(len);
    let offset = 0;
    for (let k = 0; k < this.imageParts.length; k++) {
      var frame = this.imageParts[k];
      for (let i = 0; i < frame.data.length; i++) {
        let page = frame.data[i];
        data.set(page, offset);
        if (i === frame.data.length - 1) {
          offset += frame.cursor;
        } else {
          offset += frame.pageSize;
        }
      }
    }

    let image = new Blob([data],
      {type: 'image/gif'});

    return this.emit('finished', image, data);
  }

  renderNextFrame() {
    if (this.freeWorkers.length === 0) { throw new Error('No free workers'); }
    if (this.nextFrame >= this.frames.length) { return; } // no new frame to render

    let frame = this.frames[this.nextFrame++];
    let worker = this.freeWorkers.shift();
    let task = this.getTask(frame);

    console.log(`starting frame ${ task.index + 1 } of ${ this.frames.length }`);
    this.activeWorkers.push(worker);
    return worker.postMessage(task);//, [task.data.buffer]
  }

  getContextData(ctx) {
    return ctx.getImageData(0, 0, this.options.width, this.options.height).data;
  }

  getImageData(image) {
    if (this._canvas == null) {
      this._canvas = document.createElement('canvas');
      this._canvas.width = this.options.width;
      this._canvas.height = this.options.height;
    }

    let ctx = this._canvas.getContext('2d');
    ctx.setFill = this.options.background;
    ctx.fillRect(0, 0, this.options.width, this.options.height);
    ctx.drawImage(image, 0, 0);

    return this.getContextData(ctx);
  }

  getTask(frame) {
    let index = this.frames.indexOf(frame);
    let task = {
      index,
      last: index === (this.frames.length - 1),
      delay: frame.delay,
      transparent: frame.transparent,
      width: this.options.width,
      height: this.options.height,
      quality: this.options.quality,
      repeat: this.options.repeat,
      canTransfer: (browser.name === 'chrome')
    };

    if (frame.data != null) {
      task.data = frame.data;
    } else if (frame.context != null) {
      task.data = this.getContextData(frame.context);
    } else if (frame.image != null) {
      task.data = this.getImageData(frame.image);
    } else {
      throw new Error('Invalid frame');
    }

    return task;
  }
}

export default GIF;

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
function __in__(needle, haystack) {
  return haystack.indexOf(needle) >= 0;
}