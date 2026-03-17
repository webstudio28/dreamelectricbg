(function () {
  var wrapper = document.querySelector(".popular-transfers-strip-wrapper");
  var strip = document.querySelector(".popular-transfers-strip");
  if (!wrapper || !strip) return;

  var setEl = strip.querySelector(".popular-transfers-strip-set");
  if (!setEl) return;

  var setWidth = setEl.offsetWidth;
  var position = 0;
  var dragging = false;
  var startX = 0;
  var startPos = 0;
  var speed = 0.6;

  function getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function tick() {
    if (!dragging) {
      position += speed;
      if (position >= setWidth) position -= setWidth;
    }
    wrapper.scrollLeft = position;
    requestAnimationFrame(tick);
  }

  function onDown(e) {
    dragging = true;
    startX = getClientX(e);
    startPos = wrapper.scrollLeft;
    wrapper.style.cursor = "grabbing";
  }

  function onMove(e) {
    if (!dragging) return;
    var x = getClientX(e);
    position = startPos - (x - startX);
    while (position < 0) position += setWidth;
    while (position >= setWidth) position -= setWidth;
    wrapper.scrollLeft = position;
  }

  function onUp() {
    dragging = false;
    wrapper.style.cursor = "grab";
    position = wrapper.scrollLeft % setWidth;
  }

  wrapper.style.cursor = "grab";
  // Ensure wrapper is the scroll container.
  wrapper.scrollLeft = 0;

  wrapper.addEventListener("mousedown", onDown);
  wrapper.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);

  if (setWidth > 0) requestAnimationFrame(tick);
  else window.addEventListener("load", function () {
    setWidth = setEl.offsetWidth;
    requestAnimationFrame(tick);
  });
})();
