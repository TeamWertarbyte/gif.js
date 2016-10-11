'use strict';

var _GIFEncoder = require('./GIFEncoder');

var _GIFEncoder2 = _interopRequireDefault(_GIFEncoder);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var renderFrame = function renderFrame(frame) {
  var encoder = new _GIFEncoder2.default(frame.width, frame.height);

  if (frame.index === 0) {
    encoder.writeHeader();
  } else {
    encoder.firstFrame = false;
  }

  encoder.setTransparent(frame.transparent);
  encoder.setRepeat(frame.repeat);
  encoder.setDelay(frame.delay);
  encoder.setQuality(frame.quality);
  encoder.addFrame(frame.data);
  if (frame.last) {
    encoder.finish();
  }

  var stream = encoder.stream();
  frame.data = stream.pages;
  frame.cursor = stream.cursor;
  frame.pageSize = stream.constructor.pageSize;

  if (frame.canTransfer) {
    var transfer = frame.data.map(function (page) {
      return page.buffer;
    });
    return self.postMessage(frame, transfer);
  } else {
    return self.postMessage(frame);
  }
};

self.onmessage = function (event) {
  return renderFrame(event.data);
};