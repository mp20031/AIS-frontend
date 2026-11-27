// jsdom has no layout engine, so it leaves these unimplemented: scrollTo logs
// an error on every router navigation (scrollBehavior), and BaseSelect calls
// scrollIntoView to keep the active option visible.
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}

// BaseSelect builds an id selector with CSS.escape, which jsdom lacks too.
if (!globalThis.CSS?.escape) {
  globalThis.CSS = { ...globalThis.CSS, escape: (value: string) => value.replace(/[^\w-]/g, '\\$&') } as typeof CSS
}
