const frames = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const visible = new Set<HTMLElement>();
let pending = false;

function update() {
  pending = false;
  // Read geometry together before writing transforms to avoid layout thrashing.
  const positions = [...visible].map(frame => {
    const rect = frame.getBoundingClientRect();
    const offset = (window.innerHeight / 2 - rect.top - rect.height / 2) * .14;
    return { frame, offset: Math.max(-84, Math.min(84, offset)) };
  });
  for (const { frame, offset } of positions) {
    frame.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
  }
}

function schedule() {
  if (!pending && !reducedMotion.matches && visible.size) {
    pending = true;
    requestAnimationFrame(update);
  }
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const frame = entry.target as HTMLElement;
    if (entry.isIntersecting) visible.add(frame);
    else visible.delete(frame);
  }
  schedule();
});
frames.forEach(frame => observer.observe(frame));
window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule, { passive: true });
reducedMotion.addEventListener('change', () => {
  frames.forEach(frame => frame.style.removeProperty('--parallax-y'));
  schedule();
});
