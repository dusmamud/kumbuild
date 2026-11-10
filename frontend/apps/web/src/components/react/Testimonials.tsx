import { useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "motion/react";
import { Star, ArrowLeft, ArrowRight, Quote } from "lucide-react";

export interface Testimonial {
  name: string;
  business: string;
  city: string;
  stars: number;
  text: string;
  avatar?: string;
}

/** Testimonial carousel — Embla + autoplay (pauses on hover/touch),
    one card language with the order-slip mono meta line. */
export default function Testimonials({ items }: { items: Testimonial[] }) {
  const autoplay = useRef(
    Autoplay({ delay: 5200, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", skipSnaps: false },
    [autoplay.current]
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) autoplay.current.stop();
  }, []);

  return (
    <div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-5">
          {items.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-w-0 shrink-0 grow-0 basis-full flex-col rounded-2xl border border-line bg-white p-6 transition-shadow duration-300 hover:shadow-[0_18px_36px_-24px_rgba(28,25,23,0.3)] sm:basis-[calc(50%-10px)] lg:basis-[calc(33.333%-14px)]"
            >
              <span className="flex items-center justify-between">
                <Quote className="h-6 w-6 text-primary-500" strokeWidth={1.5} aria-hidden />
                <span className="flex items-center gap-1" aria-label={`${t.stars} out of 5 stars`}>
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </span>
              </span>
              <blockquote className="mt-4 flex-1 text-base leading-[28px] text-body">
                {t.text}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3.5 border-t border-dashed border-line pt-5">
                {t.avatar && (
                  <img
                    src={t.avatar}
                    alt=""
                    width="96"
                    height="96"
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
                  />
                )}
                <span>
                  <span className="block font-display text-[15px] font-semibold text-ink">{t.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted">
                    {t.business} · {t.city}
                  </span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={scrollPrev}
          aria-label="Previous reviews"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-body transition-colors duration-200 hover:bg-surface hover:text-ink active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Next reviews"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-body transition-colors duration-200 hover:bg-surface hover:text-ink active:scale-[0.97]"
        >
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
