// What the server alone adds to SvelteKit's transport for Python
// (`transport.js`): a signature on what it encodes while it builds, the data a
// remote function prerenders above all. SvelteKit reads that data back on the
// server by fetching it from the site's own address, an origin a forged request
// could point elsewhere: so the server rebuilds the classes that data names only
// where its signature holds, and reads anything else as a value the browser
// sent, values alone. The key is the build's own, written into the server's code
// and never into the browser's (`svelthon.js`).
import { createHmac, timingSafeEqual } from 'node:crypto';

const NAMED = new Set(['g', 'r', 'n']);

// Whether a structure names a class or a function: what a signature is for.
const names = (made, seen = new Set()) => {
    if (!Array.isArray(made) || seen.has(made)) return false;

    seen.add(made);

    return NAMED.has(made[0]) || made.some((one) => names(one, seen));
};

// The text a structure is signed by, the same once SvelteKit's serialiser has
// written and read it back: its arrays with their sharing and their cycles, its
// scalars and its bytes. Undefined for anything else, a JavaScript object inside
// Python's data or a promise, which crosses unsigned.
function canonical(made) {
    const seen = new Map();
    let text = '';

    const walk = (one) => {
        if (one === null) {
            text += 'n,';
            return true;
        }

        switch (typeof one) {
            case 'undefined':
                text += 'u,';
                return true;
            case 'boolean':
                text += one ? 't,' : 'f,';
                return true;
            case 'number':
                text += `${Object.is(one, -0) ? '-0' : String(one)},`;
                return true;
            case 'bigint':
                text += `${one}n,`;
                return true;
            case 'string':
                text += `${JSON.stringify(one)},`;
                return true;
        }

        if (one instanceof Uint8Array) {
            text += `b${Buffer.from(one).toString('base64')},`;
            return true;
        }

        if (!Array.isArray(one)) return false;

        if (seen.has(one)) {
            text += `@${seen.get(one)},`;
            return true;
        }

        seen.set(one, seen.size);
        text += '[';

        for (const item of one) if (!walk(item)) return false;

        text += '],';
        return true;
    };

    return walk(made) ? text : undefined;
}

// `readingBack` says whether the server may be reading back what it prerendered:
// SvelteKit does so outside a remote function's own request, and reads a remote
// function's argument inside one, where a signed structure would be one the
// browser replayed from the site's public files.
export function signed(transport, key, building, readingBack) {
    const { encode, decode } = transport.svelthon;
    const signature = (text) => createHmac('sha256', key).update(text).digest('base64url');
    const holds = (made, given) => {
        const text = canonical(made);

        if (text === undefined || typeof given !== 'string') return false;

        const expected = Buffer.from(signature(text));
        const received = Buffer.from(given);

        return expected.length === received.length && timingSafeEqual(expected, received);
    };

    return {
        svelthon: {
            encode(thing) {
                const made = encode(thing);

                if (made === undefined || !building() || !names(made)) return made;

                const text = canonical(made);

                return text === undefined ? made : ['k', made, signature(text)];
            },
            decode(made) {
                if (!Array.isArray(made) || made[0] !== 'k') return decode(made);

                return decode(made[1], readingBack() && holds(made[1], made[2]));
            }
        }
    };
}
