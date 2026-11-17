// Nusa Raya — input layer: keyboard and mouse, scaled to the 1280x720 canvas.
// It only captures raw input; main.js decides what a click or keypress means.

const Input = {
  keys: {},
  pressed: {},
  mouse: { x: 640, y: 360, down: false },
  clicked: null,
};

function initInput(canvas, G) {
  function scaleCoords(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * 1280,
      y: ((clientY - r.top) / r.height) * 720,
    };
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) Input.pressed[e.code] = true;
    Input.keys[e.code] = true;
    AudioSys.ensure();
  });
  window.addEventListener('keyup', (e) => {
    Input.keys[e.code] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = scaleCoords(e.clientX, e.clientY);
    Input.mouse.x = p.x;
    Input.mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = scaleCoords(e.clientX, e.clientY);
    Input.mouse.x = p.x;
    Input.mouse.y = p.y;
    Input.mouse.down = true;
    Input.clicked = { x: p.x, y: p.y };
    AudioSys.ensure();
  });
  window.addEventListener('mouseup', () => {
    Input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  void G;
}

function consumeClick() {
  const c = Input.clicked;
  Input.clicked = null;
  return c;
}

function consumePressed(code) {
  const v = !!Input.pressed[code];
  if (v) Input.pressed[code] = false;
  return v;
}

function clearPressed() {
  Input.pressed = {};
}
