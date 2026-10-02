// Run under `node --expose-gc`: registers 200 checkboxes in one group whose
// scope stays alive, each on a row named by a string, destroys them, collects,
// and prints how many inputs, and how many of the targets they wrote, are still
// alive. Inputs never registered are the control that says a collection
// happened.
//
// The runtime is loaded before the document exists, as on a server: loaded
// after, Brython takes the process for a browser and starts its page observer.
import { JSDOM } from 'jsdom';
import { group } from '../../src/lib/runtime.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });

for (const name of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Node']) {
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}

const scope = {};
const registered = [];
const targets = [];
const controls = [];
const actions = [];

// In a function, so no binding of the module holds the last input made.
const register = () => {
    for (let i = 0; i < 200; i++) {
        const input = document.createElement('input');

        input.type = 'checkbox';
        document.body.appendChild(input);
        actions.push(group(input, [[], () => {}, `item-${i}`, 'selected', scope, [`row-${i}`]]));
        registered.push(new WeakRef(input));
        targets.push(new WeakRef(input.$svelthonGroup));

        const control = document.createElement('input');

        control.type = 'checkbox';
        controls.push(new WeakRef(control));
    }
};

register();

// The sort the registrations queued.
await new Promise((resolve) => setImmediate(resolve));

while (actions.length) actions.pop().destroy();
document.body.replaceChildren();

for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.gc();
}

const live = (refs) => refs.filter((ref) => ref.deref() !== undefined).length;

console.log(
    JSON.stringify({ registered: live(registered), targets: live(targets), controls: live(controls), scope: typeof scope })
);
dom.window.close();
