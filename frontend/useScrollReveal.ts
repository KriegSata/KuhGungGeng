import {useEffect, useRef} from 'react';
import {animate} from 'animejs/animation';

export function useScrollReveal(contents?: string, enabled = true) {
  const container = useRef<HTMLDivElement>(null);
  const revealed = useRef(new WeakSet<Element>());

  useEffect(() => {
    const section = container.current;
    if (!enabled || !section || !window.matchMedia || !window.IntersectionObserver) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;

    const animations: ReturnType<typeof animate>[] = [];
    const observer = new IntersectionObserver(entries => {
      for (const {target, isIntersecting} of entries) {
        if (!isIntersecting || motion.matches) continue;
        observer.unobserve(target);
        revealed.current.add(target);
        animations.push(animate(target, {opacity: [.58, 1], y: [12, 0], duration: 440, ease: 'out(3)'}));
      }
    }, {rootMargin: '0px 0px -30px'});

    for (const child of section.children) {
      if (!revealed.current.has(child)) observer.observe(child);
    }

    function stop() {
      observer.disconnect();
      for (const animation of animations.splice(0)) animation.revert();
    }
    function updateMotion() {
      if (motion.matches) stop();
    }
    motion.addEventListener('change', updateMotion);
    return () => {
      motion.removeEventListener('change', updateMotion);
      stop();
    };
  }, [contents, enabled]);

  return container;
}
