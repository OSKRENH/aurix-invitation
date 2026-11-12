const scene = document.querySelector('.scene');
const envelope = scene.querySelector('.hit-area');
const back = scene.querySelector('.back');
const pocket = scene.querySelector('.pocket');
const flap = scene.querySelector('.flap');
const hinge = scene.querySelector('.flap-hinge');
const cardLayer = scene.querySelector('.card-layer');
const card = scene.querySelector('.card');
const title = document.querySelector('.title');
const gesture = document.querySelector('.gesture');
const actions = document.querySelector('.actions');
const closeButton = document.querySelector('.close');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let metrics;
let progress = 0;
let frame = 0;
let target = 0;
let pointer = null;

const clamp = value => Math.min(1, Math.max(0, value));
const interval = (value, from, to) => clamp((value - from) / (to - from));
const smooth = value => value * value * (3 - 2 * value);
const interpolate = (from, to, amount) => from + (to - from) * amount;

function measure() {
  metrics = {
    width: back.offsetWidth,
    height: back.offsetHeight,
    center: back.offsetTop,
    viewportWidth: scene.clientWidth,
    viewport: scene.clientHeight,
    cardHeight: card.offsetHeight
  };
  paint(progress);
}

function paint(value) {
  progress = value;
  const { width, height, center, viewportWidth, viewport, cardHeight } = metrics;
  const lid = smooth(interval(value, 0, .34));
  const extract = smooth(interval(value, .17, .61));
  const turn = smooth(interval(value, .61, .96));
  const withdraw = smooth(interval(value, .55, .9));
  const envelopeDrop = height * (.49 * extract + .37 * withdraw);
  const envelopeOpacity = 1 - smooth(interval(value, .62, .95));

  // The rotated A5 sheet fits between the folds. Its lower edge clears the seam before turning.
  const landscapeHeight = width * .83 / Math.SQRT2;
  const initialScale = width * .83 / cardHeight;
  const seamAtExtraction = height * .49 - height / 2;
  const clearY = seamAtExtraction - landscapeHeight / 2 - height * .095;
  const finalY = viewport * .49 - center;
  const cardY = interpolate(interpolate(height * .015, clearY, extract), finalY, turn);
  const angle = 90 * (1 - turn);
  const radians = angle * Math.PI / 180;
  const rotatedWidth = cardHeight * (Math.sin(radians) + Math.cos(radians) / Math.SQRT2);
  const grow = smooth(interval(value, .77, 1));
  const cardScale = Math.min(interpolate(initialScale, 1, grow), (viewportWidth - 30) / rotatedWidth);

  const envelopeTransform = `translate(-50%, -50%) translateY(${envelopeDrop}px)`;
  for (const layer of [back, pocket, flap, envelope]) {
    layer.style.transform = envelopeTransform;
    layer.style.opacity = envelopeOpacity;
  }
  hinge.style.transform = `rotateX(${-174 * lid}deg)`;
  flap.style.zIndex = lid > .52 ? 1 : 4;

  const clear = value >= .61;
  const cardBottomLimit = Math.max(0, viewport - center - envelopeDrop - height / 2);
  cardLayer.style.clipPath = clear ? 'none' : `inset(0 0 ${cardBottomLimit}px)`;
  cardLayer.style.zIndex = clear ? 4 : 2;
  card.style.opacity = value > .12 ? 1 : 0;
  card.style.transform = `translate(-50%, -50%) translateY(${cardY}px) rotate(${-angle}deg) scale(${cardScale})`;

  const labelOpacity = 1 - smooth(interval(value, 0, .35));
  title.style.opacity = labelOpacity;
  title.style.transform = `translateY(${-12 * (1 - labelOpacity)}px)`;
  gesture.style.opacity = labelOpacity;
}

function settle(next, moveFocus = false) {
  cancelAnimationFrame(frame);
  target = next;
  const start = progress;
  const duration = next ? 2350 : start * 1750;

  envelope.setAttribute('aria-expanded', String(Boolean(next)));
  gesture.setAttribute('aria-expanded', String(Boolean(next)));
  if (!next) {
    envelope.disabled = false;
    gesture.hidden = false;
    if (moveFocus) envelope.focus({ preventScroll: true });
    actions.hidden = true;
    card.setAttribute('aria-hidden', 'true');
  }

  function finish() {
    paint(next);
    if (!next) return;
    card.removeAttribute('aria-hidden');
    actions.hidden = false;
    if (moveFocus) closeButton.focus({ preventScroll: true });
    envelope.disabled = true;
    gesture.hidden = true;
  }

  if (reduceMotion.matches || duration < 1) {
    finish();
    return;
  }

  const began = performance.now();
  function tick(now) {
    const elapsed = clamp((now - began) / duration);
    if (elapsed >= 1) {
      finish();
      return;
    }
    // Keep extraction and rotation distinct within the same reversible timeline.
    const eased = elapsed + Math.sin(Math.PI * elapsed) * .12;
    paint(interpolate(start, next, eased));
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
}

function openLetter() {
  pointer = null;
  if (target === 0) settle(1, true);
}

function readGesture(event) {
  const sideways = Math.abs(event.clientX - pointer.x);
  const upwards = pointer.y - event.clientY;
  pointer.moved ||= Math.max(sideways, Math.abs(upwards)) > 6;
  return upwards >= 33 && upwards > sideways;
}

function cancelGesture(event) {
  if (pointer?.id === event.pointerId) pointer = null;
}

for (const trigger of [envelope, gesture]) {
  trigger.addEventListener('pointerdown', event => {
    if (event.button !== 0 || target === 1 || pointer) return;
    trigger.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  trigger.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId && readGesture(event)) openLetter();
  });
  trigger.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    if (readGesture(event) || !pointer.moved) openLetter();
    else cancelGesture(event);
  });
  trigger.addEventListener('pointercancel', cancelGesture);
  trigger.addEventListener('lostpointercapture', cancelGesture);
  trigger.addEventListener('click', event => {
    if (event.detail === 0) openLetter();
  });
}

closeButton.addEventListener('click', () => settle(0, true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && target === 1) settle(0, true);
});

measure();
new ResizeObserver(measure).observe(scene);
