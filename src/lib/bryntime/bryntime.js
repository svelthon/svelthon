// Bryntime, the runtime a page uses to read Python from JavaScript and
// JavaScript from Python, and its one door: a host, a framework such as
// Svelte, imports this file and nothing else of the folder, and answers
// through `host` what only it knows.
//
// In this order: the scope brython.js reads as it loads (`globals.js`), the
// engine itself, started (`boot.js`), what crosses and how (`core.js`), the
// tracking of the Python values a reaction reads, which tells it when they are
// mutated (`mutations.js`), what Python raises as JavaScript reads it
// (`errors.js`), the calls between the two languages (`calls.js`), the live
// views of Python containers JavaScript reads (`views.js`), the Python
// modules a page runs, their namespaces, their bodies and what they publish
// (`modules.js`), and the protocols of Python a host's syntax asks, keys,
// `**`, a starred name and a key's lookup (`protocols.js`).
import './globals.js';
import './boot.js';

export * from './core.js';
export * from './mutations.js';
export * from './errors.js';
export * from './calls.js';
export * from './views.js';
export * from './modules.js';
export * from './protocols.js';
