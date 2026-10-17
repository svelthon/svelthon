// Bryntime, the runtime a page uses to read Python from JavaScript and
// JavaScript from Python, and its one door: a host, a framework such as
// Svelte, imports this file and nothing else of the folder, and answers
// through `host` what only it knows.
//
// In this order: the scope brython.js reads as it loads (`globals.js`), the
// engine itself, started (`boot.js`), what crosses and how (`crossing.js`), and
// the tracking of the Python values a reaction reads, which tells it when they
// are mutated (`tracking.js`).
import './globals.js';
import './boot.js';

export * from './crossing.js';
export * from './tracking.js';
