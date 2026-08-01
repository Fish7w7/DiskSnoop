const DEFAULT_WINDOW_WIDTH = 1536;
const DEFAULT_WINDOW_HEIGHT = 1004;
const MIN_WINDOW_WIDTH = 1040;
const MIN_WINDOW_HEIGHT = 700;

function finiteInteger(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function validWorkArea(display) {
  const area = display?.workArea;
  return area
    && [area.x, area.y, area.width, area.height].every((value) => Number.isFinite(Number(value)))
    && area.width > 0
    && area.height > 0;
}

function intersectionArea(bounds, area) {
  const left = Math.max(bounds.x, area.x);
  const top = Math.max(bounds.y, area.y);
  const right = Math.min(bounds.x + bounds.width, area.x + area.width);
  const bottom = Math.min(bounds.y + bounds.height, area.y + area.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function resolveWindowState(saved = {}, displays = []) {
  const availableDisplays = displays.filter(validWorkArea);
  const primaryArea = availableDisplays[0]?.workArea || {
    x: 0,
    y: 0,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT
  };
  const requestedWidth = finiteInteger(saved.width) || DEFAULT_WINDOW_WIDTH;
  const requestedHeight = finiteInteger(saved.height) || DEFAULT_WINDOW_HEIGHT;
  const requestedX = finiteInteger(saved.x);
  const requestedY = finiteInteger(saved.y);
  const requestedBounds = {
    x: requestedX ?? primaryArea.x,
    y: requestedY ?? primaryArea.y,
    width: requestedWidth,
    height: requestedHeight
  };

  const matchingDisplay = requestedX === null || requestedY === null
    ? null
    : availableDisplays
      .map((display) => ({ display, area: intersectionArea(requestedBounds, display.workArea) }))
      .sort((a, b) => b.area - a.area)[0];
  const workArea = matchingDisplay?.area > 0 ? matchingDisplay.display.workArea : primaryArea;
  const width = Math.min(Math.max(requestedWidth, Math.min(MIN_WINDOW_WIDTH, workArea.width)), workArea.width);
  const height = Math.min(Math.max(requestedHeight, Math.min(MIN_WINDOW_HEIGHT, workArea.height)), workArea.height);
  const centeredX = workArea.x + Math.round((workArea.width - width) / 2);
  const centeredY = workArea.y + Math.round((workArea.height - height) / 2);

  return {
    x: requestedX === null || matchingDisplay?.area <= 0
      ? centeredX
      : clamp(requestedX, workArea.x, workArea.x + workArea.width - width),
    y: requestedY === null || matchingDisplay?.area <= 0
      ? centeredY
      : clamp(requestedY, workArea.y, workArea.y + workArea.height - height),
    width,
    height,
    maximized: saved.maximized === true
  };
}

module.exports = {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  resolveWindowState
};
