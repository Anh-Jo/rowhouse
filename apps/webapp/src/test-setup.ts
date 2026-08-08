import '@testing-library/jest-dom';

// jsdom has no ResizeObserver; Radix positioned layers (Popover, Select…)
// observe their anchor with it. A no-op stand-in is enough — tests assert
// content, never measured geometry.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as typeof ResizeObserver;
