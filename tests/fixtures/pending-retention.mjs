// Run under `node --expose-gc`: decodes the same Python value twenty times
// where no codec is loaded, as a JavaScript page does at each visit of a route
// whose `load()` returns Python data, keeps the first copy as a page would and
// drops the others, then loads the codec. Prints how many copies the queue
// still holds and are still alive once collected, and whether Python reads the
// copy kept as the value rebuilt.
import * as devalue from 'devalue';
import { transport, codecLoaded } from '../../src/lib/transport.js';
import { __brycomp_pybridge, pyData, pyBind } from '../../src/lib/bridge.js';

const $B = globalThis.__BRYTHON__;
const CODEC = Symbol.for('svelthon.codec');
const { encode, decode } = transport.svelthon;
const made = devalue.stringify({ value: __brycomp_pybridge.bound(pyData({ answer: [1, 2] })) }, { svelthon: encode });
const codec = globalThis[CODEC];
const copies = [];
const visit = () => {
    const { value } = devalue.parse(made, { svelthon: decode });

    copies.push(new WeakRef(value));

    return value;
};

delete globalThis[CODEC];

const kept = visit();

for (let again = 1; again < 20; again++) visit();

for (let round = 0; round < 10; round++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    globalThis.gc();
}

const pending = globalThis[Symbol.for('svelthon.transport')].pending;
const measured = { queued: pending.size ?? pending.length, alive: copies.filter((one) => one.deref() !== undefined).length };

globalThis[CODEC] = codec;
codecLoaded();
measured.adopted = $B.class_name(pyBind(kept));

console.log(JSON.stringify(measured));
