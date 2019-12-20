/* jshint esnext: true, expr: true, sub: true, laxbreak: true */
/* eslint-env es6 */
/* global module, define, require, jQuery */

define(['jquery'], function($) {
  const touch_device = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const get_cursor = e => {
    if (e.originalEvent.touches) e = e.originalEvent.touches[0];
    return { x: e.clientX, y: e.clientY };
  };

  const get_resizer = (handle, element, { x, y }) => {
    const el = $(element),
      off = el.offset(),
      ow = el.width(),
      oh = el.height(),
      ox = off.left + ow / 2,
      oy = off.top + oh / 2,
      ocw = el.get(0).style.width,
      och = el.get(0).style.height,
      hdl = $(handle),
      hdloff = hdl.offset(),
      snap = ({ x: nx, y: ny }) => ({
        dx: Math.abs(x - nx) < 5 ? 0 : nx - x,
        dy: Math.abs(y - ny) < 5 ? 0 : ny - y
      }),
      resizers = [];

    if (hdloff.left > ox) resizers.push(c => el.width(snap(c).dx ? ow + (c.x - x) : ocw));
    if (hdloff.left + hdl.width() < ox)
      resizers.push(c => el.width(snap(c).dx ? ow - (c.x - x) : ocw));

    if (hdloff.top > oy) resizers.push(c => el.height(snap(c).dy ? oh + (c.y - y) : och));
    if (hdloff.top + hdl.height() < oy)
      resizers.push(c => el.height(snap(c).dy ? oh - (c.y - y) : och));

    return c => resizers.forEach(f => f(c));
  };

  const activate_drag_handle = (e, { active, sink, start, stop, drag }) => {
    if (e.preventDefault) e.preventDefault();

    const cursor = get_cursor(e),
      hdl = $(e.target).addClass('ui-resize-handle'),
      prev = hdl.prev(active).get(0),
      next = hdl.next(active).get(0),
      head_sink = sink ? hdl.prevAll(sink).length : 0,
      tail_sink = sink ? hdl.nextAll(sink).length : 0,
      elems = [];

    if (prev && !(head_sink && !tail_sink)) elems.push(prev);
    if (next && !(tail_sink && !head_sink)) elems.push(next);

    if (start && start(e, hdl, elems) === false) return;

    elems.forEach(el => $(el).addClass('ui-resize-item'));
    const resizers = elems.map(el => get_resizer(hdl, el, cursor));

    $(document).bind(
      'mousemove.resize-handle' + (touch_device ? ' touchmove.resize-handle' : ''),
      e => {
        if (drag) drag(e, hdl, elems);
        const cur = get_cursor(e);
        resizers.forEach(r => r(cur));
      }
    );
    $(document).bind('selectstart.resize-handle', () => false);
    $(document).bind(
      'mouseup.resize-handle' + (touch_device ? ' touchend.resize-handle' : ''),
      () => {
        $(document).unbind('.resize-handle');
        elems.forEach(el => $(el).removeClass('ui-resize-item'));
        if (stop && stop(e, hdl, elems) === false) resizers.forEach(r => r(cursor));
        return false;
      }
    );

    return false;
  };

  const default_options = {
    active: '', // siblings that shall be resized
    sink: '', // siblings that absorbs excess of size change
    start: null, // return false to cancel resizing
    stop: null, // return false to reset resizing
    drag: null
  };

  $.fn.resizeHandle = function resizeHandle(options) {
    options = $.extend(true, {}, default_options, options);
    return this.each((i, handle) => {
      $(handle)
        .css('touch-action', 'none')
        .bind('mousedown touchstart', e => activate_drag_handle(e, options));
    });
  };
});
