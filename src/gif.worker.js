import GIFEncoder from './GIFEncoder';

let renderFrame = function(frame) {
  let encoder = new GIFEncoder(frame.width, frame.height);

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
  if (frame.last) { encoder.finish(); }

  let stream = encoder.stream();
  frame.data = stream.pages;
  frame.cursor = stream.cursor;
  frame.pageSize = stream.constructor.pageSize;

  if (frame.canTransfer) {
    let transfer = (frame.data.map((page) => page.buffer));
    return self.postMessage(frame, transfer);
  } else {
    return self.postMessage(frame);
  }
};

self.onmessage = event => renderFrame(event.data);
