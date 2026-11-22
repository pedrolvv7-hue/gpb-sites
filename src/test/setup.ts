import '@testing-library/jest-dom/vitest'
// Recharts usa ResizeObserver
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = RO
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
