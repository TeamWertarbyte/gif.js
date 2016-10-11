'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _wolfy87Eventemitter = require('wolfy87-eventemitter');

var _wolfy87Eventemitter2 = _interopRequireDefault(_wolfy87Eventemitter);

var _browser = require('./browser');

var _browser2 = _interopRequireDefault(_browser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var defaults = {
  workers: 2,
  repeat: 0, // repeat forever, -1 = repeat once
  background: '#fff',
  quality: 10, // pixel sample interval, lower is better
  width: null, // size derermined from first frame if possible
  height: null,
  transparent: null
};

var frameDefaults = {
  delay: 500, // ms
  copy: false
};

var GIF = function (_EventEmitter) {
  _inherits(GIF, _EventEmitter);

  function GIF(options) {
    _classCallCheck(this, GIF);

    var _this = _possibleConstructorReturn(this, (GIF.__proto__ || Object.getPrototypeOf(GIF)).call(this));

    _this.running = false;

    _this.options = {};
    _this.frames = [];

    _this.freeWorkers = [];
    _this.activeWorkers = [];

    _this.setOptions(options);
    for (var key in defaults) {
      var value = defaults[key];
      if (_this.options[key] == null) {
        _this.options[key] = value;
      }
    }

    if (!options.worker) {
      throw new Error('No worker specified');
    }
    return _this;
  }

  _createClass(GIF, [{
    key: 'setOption',
    value: function setOption(key, value) {
      this.options[key] = value;
      if (this._canvas != null && key === 'width' || key === 'height') {
        return this._canvas[key] = value;
      }
    }
  }, {
    key: 'setOptions',
    value: function setOptions(options) {
      var _this2 = this;

      return function () {
        var result = [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = Object.keys(options)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var key = _step.value;

            var value = options[key];
            result.push(_this2.setOption(key, value));
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        return result;
      }();
    }
  }, {
    key: 'addFrame',
    value: function addFrame(image) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var frame = {};
      frame.transparent = this.options.transparent;
      for (var key in frameDefaults) {
        frame[key] = options[key] || frameDefaults[key];
      }

      // use the images width and height for options unless already set
      if (this.options.width == null) {
        this.setOption('width', image.width);
      }
      if (this.options.height == null) {
        this.setOption('height', image.height);
      }

      if (typeof ImageData !== 'undefined' && ImageData !== null && image instanceof ImageData) {
        frame.data = image.data;
      } else if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D !== null && image instanceof CanvasRenderingContext2D || typeof WebGLRenderingContext !== 'undefined' && WebGLRenderingContext !== null && image instanceof WebGLRenderingContext) {
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
  }, {
    key: 'render',
    value: function render() {
      if (this.running) {
        throw new Error('Already running');
      }

      if (this.options.width == null || this.options.height == null) {
        throw new Error('Width and height must be set prior to rendering');
      }

      this.running = true;
      this.nextFrame = 0;
      this.finishedFrames = 0;

      this.imageParts = __range__(0, this.frames.length, false).map(function (i) {
        return null;
      });
      var numWorkers = this.spawnWorkers();
      var iterable = __range__(0, numWorkers, false);
      for (var j = 0; j < iterable.length; j++) {
        var i = iterable[j];this.renderNextFrame();
      }

      this.emit('start');
      return this.emit('progress', 0);
    }
  }, {
    key: 'abort',
    value: function abort() {
      while (true) {
        var worker = this.activeWorkers.shift();
        if (worker == null) {
          break;
        }
        console.log("killing active worker");
        worker.terminate();
      }
      this.running = false;
      return this.emit('abort');
    }

    // private

  }, {
    key: 'spawnWorkers',
    value: function spawnWorkers() {
      var _this3 = this;

      var numWorkers = Math.min(this.options.workers, this.frames.length);
      __range__(this.freeWorkers.length, numWorkers, false).forEach(function (i) {
        console.log('spawning worker ' + i);
        var worker = new _this3.options.worker();
        worker.onmessage = function (event) {
          _this3.activeWorkers.splice(_this3.activeWorkers.indexOf(worker), 1);
          _this3.freeWorkers.push(worker);
          return _this3.frameFinished(event.data);
        };
        return _this3.freeWorkers.push(worker);
      });
      return numWorkers;
    }
  }, {
    key: 'frameFinished',
    value: function frameFinished(frame) {
      console.log('frame ' + frame.index + ' finished - ' + this.activeWorkers.length + ' active');
      this.finishedFrames++;
      this.emit('progress', this.finishedFrames / this.frames.length);
      this.imageParts[frame.index] = frame;
      if (__in__(null, this.imageParts)) {
        return this.renderNextFrame();
      } else {
        return this.finishRendering();
      }
    }
  }, {
    key: 'finishRendering',
    value: function finishRendering() {
      var len = 0;
      for (var j = 0; j < this.imageParts.length; j++) {
        var frame = this.imageParts[j];
        len += (frame.data.length - 1) * frame.pageSize + frame.cursor;
      }
      len += frame.pageSize - frame.cursor;
      console.log('rendering finished - filesize ' + Math.round(len / 1000) + 'kb');
      var data = new Uint8Array(len);
      var offset = 0;
      for (var k = 0; k < this.imageParts.length; k++) {
        var frame = this.imageParts[k];
        for (var i = 0; i < frame.data.length; i++) {
          var page = frame.data[i];
          data.set(page, offset);
          if (i === frame.data.length - 1) {
            offset += frame.cursor;
          } else {
            offset += frame.pageSize;
          }
        }
      }

      var image = new Blob([data], { type: 'image/gif' });

      return this.emit('finished', image, data);
    }
  }, {
    key: 'renderNextFrame',
    value: function renderNextFrame() {
      if (this.freeWorkers.length === 0) {
        throw new Error('No free workers');
      }
      if (this.nextFrame >= this.frames.length) {
        return;
      } // no new frame to render

      var frame = this.frames[this.nextFrame++];
      var worker = this.freeWorkers.shift();
      var task = this.getTask(frame);

      console.log('starting frame ' + (task.index + 1) + ' of ' + this.frames.length);
      this.activeWorkers.push(worker);
      return worker.postMessage(task); //, [task.data.buffer]
    }
  }, {
    key: 'getContextData',
    value: function getContextData(ctx) {
      return ctx.getImageData(0, 0, this.options.width, this.options.height).data;
    }
  }, {
    key: 'getImageData',
    value: function getImageData(image) {
      if (this._canvas == null) {
        this._canvas = document.createElement('canvas');
        this._canvas.width = this.options.width;
        this._canvas.height = this.options.height;
      }

      var ctx = this._canvas.getContext('2d');
      ctx.setFill = this.options.background;
      ctx.fillRect(0, 0, this.options.width, this.options.height);
      ctx.drawImage(image, 0, 0);

      return this.getContextData(ctx);
    }
  }, {
    key: 'getTask',
    value: function getTask(frame) {
      var index = this.frames.indexOf(frame);
      var task = {
        index: index,
        last: index === this.frames.length - 1,
        delay: frame.delay,
        transparent: frame.transparent,
        width: this.options.width,
        height: this.options.height,
        quality: this.options.quality,
        repeat: this.options.repeat,
        canTransfer: _browser2.default.name === 'chrome'
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
  }]);

  return GIF;
}(_wolfy87Eventemitter2.default);

exports.default = GIF;


function __range__(left, right, inclusive) {
  var range = [];
  var ascending = left < right;
  var end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (var i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
function __in__(needle, haystack) {
  return haystack.indexOf(needle) >= 0;
}