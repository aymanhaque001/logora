import { useState, useEffect, useRef } from 'react'

/**
 * Returns [ref, isInView] — isInView becomes true once the element
 * has entered the viewport (and stays true). Useful for lazy-loading.
 */
export function useInView(options?: IntersectionObserverInit): [React.RefObject<HTMLAnchorElement>, boolean] {
  const ref = useRef<HTMLAnchorElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px', ...options },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView, options])

  return [ref, inView]
}
