import { DestroyRef, Directive, ElementRef, afterNextRender, booleanAttribute, inject, input, numberAttribute } from '@angular/core';

export type RevealAnimation = 'fade-up' | 'fade' | 'slide-left' | 'slide-right' | 'slide-down' | 'zoom' | 'spin-left' | 'spin-right';

/**
 * Animates an element when it enters the viewport and resets it when it leaves.
 * With `revealStagger` (ms) the direct children are animated one after another instead of the host.
 * Runs only in the browser, so the server-rendered HTML stays fully visible.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealOnScroll {
  readonly appReveal = input<RevealAnimation | ''>('');
  readonly revealDelay = input(0, { transform: numberAttribute });
  readonly revealStagger = input(0, { transform: numberAttribute });
  readonly revealOnce = input(false, { transform: booleanAttribute });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;

      const stagger = this.revealStagger();
      const targets = stagger > 0 ? (Array.from(host.children) as HTMLElement[]) : [host];
      targets.forEach((el, i) => {
        el.dataset['reveal'] = this.appReveal() || 'fade-up';
        el.style.setProperty('--reveal-delay', `${this.revealDelay() + i * stagger}ms`);
        el.classList.add('reveal-pending');
      });

      const observer = new IntersectionObserver(
        ([entry]) => {
          targets.forEach((el) => el.classList.toggle('reveal-visible', entry.isIntersecting));
          if (entry.isIntersecting && this.revealOnce()) observer.disconnect();
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
