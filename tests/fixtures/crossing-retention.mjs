// Run under `node --expose-gc`, with `read` or `write`: reads, or writes,
// through the relay of `bind:group` on a component, each pair closing over an
// object of its own, drops them, collects, and prints how many are still
// alive. The last use is the one a relay that kept its pair would hold. Plain
// closures are the control that says a collection happened.
import { __pybridge } from '../../src/lib/bridge.js';

const reading = process.argv[2] === 'read';
const held = [];
const closures = [];

for (let i = 0; i < 16; i++) {
    const one = { i };
    held.push(new WeakRef(one));
    closures.push(new WeakRef(() => i));
    if (reading) void __pybridge.crossing[__pybridge.pair(() => one, () => {})];
    else __pybridge.crossing[__pybridge.pair(() => undefined, () => one)] = i;
}

for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.gc();
}

const live = (refs) => refs.filter((ref) => ref.deref() !== undefined).length;

process.stdout.write(JSON.stringify({ held: live(held), closures: live(closures) }));
