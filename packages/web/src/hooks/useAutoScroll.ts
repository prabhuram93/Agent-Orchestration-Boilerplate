import { useRef, useEffect, useCallback } from 'react'

export function useAutoScroll<T extends HTMLElement>(dependencies: unknown[] = []) {
  const containerRef = useRef<T>(null)
  const shouldAutoScrollRef = useRef(true)

  // Auto-scroll to bottom when dependencies update (if user hasn't scrolled up)
  useEffect(() => {
    if (shouldAutoScrollRef.current && containerRef.current) {
      // Use setTimeout to ensure DOM has updated before scrolling
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  // Track user scroll behavior
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      // Consider "at bottom" if within 10px of the bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
      shouldAutoScrollRef.current = isAtBottom
    }
  }, [])

  const resetAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = true
  }, [])

  return {
    containerRef,
    handleScroll,
    resetAutoScroll,
  }
}

