/** Animación "vuela al carrito": clona la imagen del producto y la lleva al pedido. */
export function flyToCart(source: Element | null) {
  const target = document.querySelector('[data-cart-target]');
  if (!source || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return bump(target);
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 150);
  const ghost = source.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    margin: '0',
    zIndex: '500',
    pointerEvents: 'none',
    borderRadius: '24px',
    overflow: 'hidden',
  });
  ghost.classList.add('fly-ghost');
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + Math.min(to.height / 2, 60) - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 90}px) scale(0.7) rotate(-12deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(8deg)`, opacity: 0.2 },
    ],
    { duration: 620, easing: 'cubic-bezier(.5,0,.3,1)' },
  );
  anim.onfinish = () => {
    ghost.remove();
    bump(target);
  };
}

function bump(target: Element | null) {
  if (!target) return;
  target.classList.remove('bump');
  void (target as HTMLElement).offsetWidth;
  target.classList.add('bump');
}
