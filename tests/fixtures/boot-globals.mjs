// What boot.js decides, reached the only way it can be reached: a fresh process.
//
// The decision runs once, guarded by `$B.$svelthon_booted`, and it reads the set
// of global names recorded by globals.js *before* Brython loads. Nothing inside
// an already-booted process can put that back, so each scenario is a child node
// process and this file is what it runs.
//
// Run as: node tests/fixtures/boot-globals.mjs <scenario>
const scenario = process.argv[2];

// `window` is what marks a real browser, and it is the whole of the first
// condition: the globals belong to the page there, and none of them are ours to
// remove. Nothing else about the object is read.
if (scenario === 'browser') globalThis.window = { fake: true };

// A stub name the host already owns, off a browser. `HTMLElement` rather than
// `location`, which Brython reads at load — `location.origin + location.pathname`
// — so a fake one takes the bootstrap down before the decision is reached.
if (scenario === 'hosted') globalThis.HTMLElement = class Mine {};

await import('../../src/lib/bryntime/globals.js');

// Laid down between the two imports: absent from the recorded set, and not a
// stub name. The cleanup has two reasons to leave it alone and needs both.
globalThis.__witness = 'mine';

await import('../../src/lib/bryntime/boot.js');

process.stdout.write(
    JSON.stringify({
        document: typeof globalThis.document,
        location: typeof globalThis.location,
        HTMLElement: typeof globalThis.HTMLElement,
        MutationObserver: typeof globalThis.MutationObserver,
        customElements: typeof globalThis.customElements,
        // The host's own class, by name: if it survived as `Mine`, Brython did
        // not even overwrite it, which is the stronger of the two answers.
        element: globalThis.HTMLElement?.name ?? null,
        witness: globalThis.__witness ?? null
    })
);
