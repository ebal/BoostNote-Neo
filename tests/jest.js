// Here you can mock the libraries connected through direct insertion <script src="" >
global.Raphael = {
  setWindow: jest.fn(),
  registerFont: jest.fn(),
  fn: function () {
    return {}
  }
}

global._ = {
  extend: jest.fn()
}

// jsdom does not implement layout; CodeMirror measures text through Range
// rects while it initialises, so give it empty ones.
if (typeof window !== 'undefined' && window.Range) {
  const emptyRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0
  })
  window.Range.prototype.getBoundingClientRect = emptyRect
  window.Range.prototype.getClientRects = () => {
    const rects = []
    rects.item = () => null
    return rects
  }
}
