import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Use e.matches for the event, or check window width as fallback
      const matches = 'matches' in e ? e.matches : window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(matches)
    }
    
    // Set initial value
    setIsMobile(mql.matches)
    
    // Use modern addEventListener/removeEventListener with proper typing
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    } else {
      // Fallback for older browsers that use deprecated addListener/removeListener
      mql.addListener(onChange as any)
      return () => mql.removeListener(onChange as any)
    }
  }, [])

  return !!isMobile
}
