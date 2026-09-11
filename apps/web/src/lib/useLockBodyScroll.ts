import { useEffect } from "react";

/** Блокирует прокрутку/перетягивание фона на время, пока смонтирован вызвавший
 * её полноэкранный экран (см. globals.css: body.body-scroll-locked). */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("body-scroll-locked");
    document.body.classList.add("body-scroll-locked");
    return () => {
      document.documentElement.classList.remove("body-scroll-locked");
      document.body.classList.remove("body-scroll-locked");
    };
  }, [active]);
}
