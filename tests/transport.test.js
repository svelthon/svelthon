// What Python hands the browser through SvelteKit's transport, written and read
// as SvelteKit writes and reads it, devalue's JSON for a navigation and its
// JavaScript for the page it renders: the same types at the other end, the
// sharing and the cycles, an instance of the class it was (`transport.js`).
import { test, expect } from 'vitest';
import * as devalue from 'devalue';
import { transport, codecLoaded, serverLoad, liveLoad, applicationTransport } from '../src/lib/transport.js';
import { pickled, unpickled } from 'bryntime';
import { __pybridge, pyBind, routeLoad, routeServerLoad, routeActions, routeData, remoteHelper } from '../src/lib/bridge.js';
import {
    values,
    load,
    layout,
    merge_layout,
    merge_section,
    merge_page,
    walked,
    pointed,
    streamed,
    actions,
    one,
    two,
    callables,
    lossy,
    unpicklable,
    remote_lossy,
    remote_batch,
    remote_live,
    remote_hook,
    bumped,
    kept,
    stored,
    STORE,
    hooked,
    Point,
    describe,
    data_of
} from './fixtures/transport_data.py';
import { Vault } from './fixtures/transport_vault.py';
import { mount, flushSync } from './mounted.js';
import FormAnswer from './fixtures/FormAnswer.svelte';

const $B = globalThis.__BRYTHON__;
const { encode, decode } = transport.svelthon;
const CODEC = Symbol.for('svelthon.codec');

// As a navigation carries it, and as the page SvelteKit renders writes it.
const viaJson = (value) => devalue.parse(devalue.stringify(value, { svelthon: encode }), { svelthon: decode });
const viaScript = (value) => {
    const replacer = (thing) => {
        const made = encode(thing);

        return made ? `app.decode('svelthon', ${devalue.uneval(made, replacer)})` : undefined;
    };

    return new Function('app', `return ${devalue.uneval(value, replacer)}`)({ decode: (_, made) => decode(made) });
};

const shown = (value) => String(describe(pyBind(value)));

test.for([
    ['tuple', 'tuple:(1, (2, 3))'],
    ['keys', "dict:{1: 'a', None: 'b'}"],
    ['set', "set:{'c', 'a', 'b'}"],
    ['shared', 'dict:{\'a\': [1], \'b\': [1]} same=True'],
    ['loop', 'list:[1, [...]] cycle=True'],
    ['point', 'Point:Point(3)'],
    ['bytes', "bytes:b'ab'"],
    ['complex', 'complex:(1-2j)'],
    ['money', 'Money:(3+4j)']
])('%s reads in Python as it was written, by either way', ([key, expected]) => {
    const value = $B.$getitem(pyBind(values()), key);

    expect(shown(viaJson({ value: viewOrSelf(value) }).value)).toBe(expected);
    expect(shown(viaScript({ value: viewOrSelf(value) }).value)).toBe(expected);
});

test('an iterator part-way crosses where it stands, in the dict that holds it', () => {
    const crossed = viaJson({ data: __pybridge.bound(pyBind(values())) }).data;

    expect(String(describe($B.$getitem(pyBind(crossed), 'zipped')))).toBe("zip:[(2, 'b'), (3, 'c')]");
});

// What a `load()` or a prop hands JavaScript: the view, or the scalar itself.
function viewOrSelf(value) {
    return __pybridge.bound(value);
}

test('the data of a load() keeps its floats at the top, and its page reads a dict', async () => {
    const node = await routeLoad(load, 'load — transport')({});
    const crossed = viaScript({ type: 'data', data: node }).data;

    // SvelteKit's merge of a layout's data into its page's.
    const parent = await routeLoad(layout, 'layout — transport')({});
    const merged = { ...viaJson(parent), ...crossed };

    expect(merged.top).toBe(1);
    expect(merged.both).toBe('page');
    expect(String(describe(routeData(merged)))).toBe("dict:{'both': 'page', 'first': 2.0, 'top': 1.0, 'rows': (1, 2)}");
});

// The merge is `{**layout, **page}`: a page's value that reads in JavaScript as
// the layout's did is the page's, `1` over `1.0`, the layout's keys first; two
// keys JavaScript names alike, `1` and `"1"`, are two; `1.0` and `1` are one,
// the layout's key with the page's value. Each node's data unmarked when it
// held nothing JavaScript reads back otherwise, the layout's value stood; and
// a key that shared its name with another took its place. As the server renders
// it, in the browser each node's data crossed, and run there by a universal
// `load()`.
test.for([
    ['typed', "dict:{'amount': 1, 'layer': 'page', 'masthead': 'm', 'page_field': 'p'}"],
    ['int-str', "dict:{1: 'layout-int', 'shared': 'page', 'layout_field': 'layout only', '1': 'page-string', 'page_field': 'page only'}"],
    ['str-int', "dict:{'1': 'layout-string', 'shared': 'page', 'layout_field': 'layout only', 1: 'page-int', 'page_field': 'page only'}"],
    ['float-int', "dict:{1.0: 'page'}"]
])('a layout and its page merge as {**layout, **page}: %s', async ([kind, expected]) => {
    const event = { kind };
    const [served, page] = [await routeServerLoad(merge_layout, 'layout — merge')(event), await routeServerLoad(merge_page, 'page — merge')(event)];
    const crossed = { ...viaJson(served), ...viaScript({ type: 'data', data: page }).data };
    const universal = { ...(await routeLoad(merge_layout, 'layout — merge')(event)), ...(await routeLoad(merge_page, 'page — merge')(event)) };

    expect([{ ...served, ...page }, crossed, universal].map((data) => String(describe(routeData(data))))).toEqual([expected, expected, expected]);
});

// And three nodes writing keys equal in Python that JavaScript tells apart,
// `True`, `1`, `True`: the first node's key with the page's value, where the
// nested layout's stood, the third write having gone to the first key's place
// before the dict was made of them.
test.for([
    ['bool-int-bool', "dict:{True: 'page'}"],
    ['int-bool-int', "dict:{1: 'page'}"]
])('three nodes merge as {**root, **section, **page}: %s', async ([kind, expected]) => {
    const event = { kind };
    const [root, section, page] = [
        await routeServerLoad(merge_layout, 'root — merge')(event),
        await routeServerLoad(merge_section, 'section — merge')(event),
        await routeServerLoad(merge_page, 'page — merge')(event)
    ];
    const crossed = { ...viaJson(root), ...viaJson(section), ...viaScript({ type: 'data', data: page }).data };

    expect([{ ...root, ...section, ...page }, crossed].map((data) => String(describe(routeData(data))))).toEqual([expected, expected]);
});

// And a node of JavaScript's after a Python one, writing the name of a Python
// key, `"1"` over the layout's `1`: its key is the string, and the Python one
// stays, where it was taken out.
test('a JavaScript node writing the name of a Python key adds its own', async () => {
    const served = await routeServerLoad(merge_layout, 'layout — merge')({ kind: 'int-str' });

    expect(String(describe(routeData({ ...served, 1: 'from-js' })))).toBe("dict:{1: 'layout-int', 'shared': 'layout', 'layout_field': 'layout only', '1': 'from-js'}");
});

// And a `load()` of JavaScript's that leaves a Python key out of what it
// returns: its copy carries the symbol that says where the values came from,
// and the key left out came back, `"omitted" in data` true where Svelte's page
// saw it gone. As the server holds the node's data and as the browser reads it.
test.for([
    ['by destructuring', ({ layout_field, ...rest }) => rest, "dict:{1: 'layout-int', 'shared': 'layout'}"],
    ['by deleting it from a copy', (data) => {
        const copy = { ...data };

        delete copy.shared;
        return copy;
    }, "dict:{1: 'layout-int', 'layout_field': 'layout only'}"],
    ['under another name', ({ layout_field, ...rest }) => ({ ...rest, renamed: layout_field }), "dict:{1: 'layout-int', 'shared': 'layout', 'renamed': 'layout only'}"]
])('a key a JavaScript load() leaves out is gone, %s', async ([, project, expected]) => {
    const served = await routeServerLoad(merge_layout, 'layout — merge')({ kind: 'int-str' });

    expect([project(served), project(viaJson(served))].map((data) => String(describe(routeData(data))))).toEqual([expected, expected]);
});

// And left out by a page whose layout gives a key of the same name: the merge
// holds the layout's, and the page's came back over it, `data[1] == "page"`
// where Python's merge of what each returned has `data["1"]` alone, and the
// layout's `2.0` was read as the page's `1`.
test.for([
    ['str-int', ({ 1: left, ...rest }) => rest, "dict:{'1': 'layout-string', 'shared': 'page', 'layout_field': 'layout only', 'page_field': 'page only'}"],
    ['float-other', ({ score, ...rest }) => rest, "dict:{'score': 2.0}"]
])('a key a page leaves out under its layout’s name is the layout’s: %s', async ([kind, project, expected]) => {
    const event = { kind };
    const [served, page] = [await routeServerLoad(merge_layout, 'layout — merge')(event), await routeServerLoad(merge_page, 'page — merge')(event)];
    const merged = [{ ...served, ...project(page) }, { ...viaJson(served), ...project(viaScript({ type: 'data', data: page }).data) }];

    expect(merged.map((data) => String(describe(routeData(data))))).toEqual([expected, expected]);
});

// A `load()` of JavaScript's returning Python values that share a list, at any
// depth, in an array or a Map: written whole from the outermost container that
// holds two, SvelteKit's envelope aside, they share it in the browser too, and
// each container stays JavaScript's own, a BigInt beside them and a cycle
// through them as well.
test.for([
    ['JSON', viaJson],
    ['the page’s script', viaScript]
])('the Python values a JavaScript load() returns keep what they share, and its containers theirs, by %s', ([, via]) => {
    const returned = { one, nested: { two }, both: [one], held: new Map([['two', two]]), big: 2n ** 70n };

    returned.self = returned;

    const data = via({ type: 'data', data: returned, uses: {} }).data;

    expect(data.nested.two.list).toBe(data.one.list);
    expect(data.both[0]).toBe(data.one);
    expect(data.held.get('two')).toBe(data.nested.two);
    expect([Array.isArray(data.both), data.held instanceof Map, typeof data.big, data.self === data]).toEqual([true, true, 'bigint', true]);
    data.one.list.push(9);
    expect([...data.nested.two.list]).toEqual([1, 9]);
});

// A group decoded before its values can be rebuilt, SvelteKit's remote data at
// hydration among them: copies JavaScript reads, each read by Python, once the
// codec is there, as the value rebuilt. So does a page, through the array of
// JavaScript's that holds them, and a copy alone two levels down: the engine,
// walking those, read each as the plain object.
test('a group read before the codec is there is copies, each read by Python as its value', () => {
    const view = __pybridge.bound(pyBind(values()));
    const made = devalue.stringify({ point: view.point, two }, { svelthon: encode });
    const listed = devalue.stringify({ items: [view.point, two] }, { svelthon: encode });
    const deep = devalue.stringify({ deep: { value: view.point } }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let group;
    let items;
    let nested;

    delete globalThis[CODEC];

    try {
        [group, items, nested] = [made, listed, deep].map((one) => devalue.parse(one, { svelthon: decode }));
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect(JSON.stringify(group.point)).toBe('{"x":3}');
    expect([shown(group.point), shown(group.two)]).toEqual(['Point:Point(3)', "dict:{'list': [1]}"]);
    expect([...$B.make_js_iterator($B.$getitem(routeData(items), 'items'))].map(shown)).toEqual(['Point:Point(3)', "dict:{'list': [1]}"]);
    expect(shown($B.$getitem($B.$getitem(routeData(nested), 'deep'), 'value'))).toBe('Point:Point(3)');
});

// The data of a server's `load()` for a page it renders, which crosses, its page
// reads there too as the browser reads it, the value pickle carries, and the
// browser rebuilds it from the very structure the server rebuilt it from: a
// reduction that hands over another value at each pass reads the same. A
// universal `load()`'s, which never crosses, is read as it was returned, and so
// is the data of a data request, where no page renders. What pickle refuses is
// refused at the `load()`, in its words. Data no copy of could differ from is
// the value itself, a store the module keeps among them, its structure made
// at each `load()`.
test('a server’s load() hands its page the value pickle carries, a universal one what it returned', async () => {
    const seen = (data) => String($B.$getattr(pyBind(data.reduced), 'seen'));
    const server = await routeServerLoad(lossy, 'lossy — transport')({});
    const counted = (data) => String($B.$getattr(pyBind(data.bumped), 'n'));
    const once = await routeServerLoad(bumped, 'bumped — transport')({});

    expect([seen(server), seen(await routeLoad(lossy, 'lossy — transport')({}))]).toEqual(['kept', 'changed']);
    expect(seen(await routeServerLoad(lossy, 'lossy — transport')({ isDataRequest: true }))).toBe('changed');
    expect(seen(viaScript({ type: 'data', data: server, uses: {} }).data)).toBe('kept');
    expect([counted(once), counted(viaScript({ type: 'data', data: once, uses: {} }).data)]).toEqual(['2', '2']);
    expect(() => routeServerLoad(unpicklable, 'unpicklable — transport')({})).toThrow(/Can't pickle/);

    const rows = $B.$getitem(pyBind(STORE), 'rows');
    const store = await routeServerLoad(stored, 'stored — transport')({});

    expect(pyBind(store.rows)).toBe(rows);
    expect(shown(viaScript({ type: 'data', data: store, uses: {} }).data.rows)).toBe('list:[Point(1), Point(2)] cycle=False');
    $B.$call($B.$getattr(rows, 'append'), $B.$call(pyBind(Point), 3));

    try {
        const again = await routeServerLoad(stored, 'stored — transport')({});

        expect(shown(viaScript({ type: 'data', data: again, uses: {} }).data.rows)).toBe('list:[Point(1), Point(2), Point(3)] cycle=False');
    } finally {
        $B.$call($B.$getattr(rows, 'pop'));
    }
});

// What pickle refuses as SvelteKit writes the data, the transport throws with a
// place in the data, as devalue's own errors have one: SvelteKit reads it.
test('a refusal the transport throws has its place in the data, which SvelteKit reads', () => {
    const view = __pybridge.bound(pyBind(remote_hook()));
    let caught;

    try {
        devalue.stringify({ data: view }, { svelthon: encode });
    } catch (error) {
        caught = error;
    }

    expect([caught?.path, String(caught?.message)]).toEqual(['', expect.stringMatching(/Can't pickle/)]);
});

// A `load()` of a JavaScript server module returning Python values: its page
// reads on the server what the browser reads, one value or a group of them,
// what they share still shared; the data of a data request as it was.
test('a JavaScript server load() hands its page the Python values it returns as the browser reads them', async () => {
    const seen = (one) => String($B.$getattr(pyBind(one), 'seen'));
    const returned = () => ({ reduced: remote_lossy().reduced, label: 'js' });
    const grouped = async () => ({ one, two, reduced: remote_lossy().reduced });
    const single = await serverLoad(returned)({});
    const group = await serverLoad(grouped)({});

    expect([seen(single.reduced), single.label, seen((await serverLoad(returned)({ isDataRequest: true })).reduced)]).toEqual(['kept', 'js', 'changed']);
    expect([seen(group.reduced), group.one.list === group.two.list]).toEqual(['kept', true]);
    expect(seen(viaScript({ type: 'data', data: group, uses: {} }).data.reduced)).toBe('kept');
    expect(seen(viaJson({ data: single }).data.reduced)).toBe('kept');

    // The dict of the data itself, a Python function's: as a Python `load()`'s.
    const whole = await serverLoad(() => remote_lossy())({});

    expect([seen(whole.reduced), seen(viaScript({ type: 'data', data: whole, uses: {} }).data.reduced)]).toEqual(['kept', 'kept']);

    // And a value no copy of could differ from is that value.
    const rows = await serverLoad(() => ({ rows: STORE.rows }))({});

    expect([pyBind(rows.rows) === $B.$getitem(pyBind(STORE), 'rows'), shown(viaJson({ data: rows }).data.rows)]).toEqual([true, 'list:[Point(1), Point(2)] cycle=False']);
});

// What a JavaScript `load()` keeps and returns at each request, empty at first
// and later holding Python values, is walked as it is at each return: its page
// reads their copies, though the store was found once holding none.
test('a JavaScript load() is walked at each return, whatever it held before', async () => {
    const seen = (one) => String($B.$getattr(pyBind(one), 'seen'));
    const state = { items: [] };
    const load = serverLoad(() => state);
    const first = await load({});

    expect([first.items === state.items, JSON.stringify(viaScript({ type: 'data', data: first, uses: {} }).data)]).toEqual([true, '{"items":[]}']);

    // Another request.
    await new Promise((done) => setTimeout(done));
    state.items.push(remote_lossy().reduced, remote_lossy().reduced);

    const filled = await load({});
    const browser = viaScript({ type: 'data', data: filled, uses: {} }).data;

    expect([...filled.items, ...browser.items].map(seen)).toEqual(['kept', 'kept', 'kept', 'kept']);
});

// A cycle of JavaScript containers around Python values, an entry and a
// neighbour pointing back at it, comes out one graph again whatever the order
// it was made in: met before the entry's own values, the neighbour held none,
// stayed the object it was and pointed back at the entry of before.
test.for([
    ['JSON', viaJson],
    ['the page’s script', viaScript]
])('a cycle of JavaScript containers around Python values is one graph again, in either order, by %s', async ([, via]) => {
    const made = (linkFirst) => {
        const entry = {};
        const neighbour = { back: entry };

        if (linkFirst) entry.next = neighbour;
        entry.one = one;
        entry.two = two;
        if (!linkFirst) entry.next = neighbour;
        return { entry };
    };
    const read = ({ entry }) => [entry.next.back === entry, entry.next.back.one === entry.one, entry.two.list === entry.one.list];

    for (const linkFirst of [true, false]) {
        const server = await serverLoad(() => made(linkFirst))({});

        expect([read(server), read(via({ type: 'data', data: server, uses: {} }).data)]).toEqual([
            [true, true, true],
            [true, true, true]
        ]);
    }
});

// A module that binds its `load` again is served the one bound at each call,
// as SvelteKit reads the module's export at each request, one it binds only
// later too; a falsy one is skipped.
test('a JavaScript server load() bound again is the one called next', async () => {
    let bound = () => {
        bound = () => ({ turn: 'second' });
        return { turn: 'first' };
    };
    const load = liveLoad(() => bound);
    const turns = [];

    for (let at = 0; at < 3; at++) turns.push((await load({})).turn);
    expect(turns).toEqual(['first', 'second', 'second']);
    bound = null;
    expect(await load({})).toBeUndefined();

    let later;
    const late = liveLoad(() => later);

    expect(await late({})).toBeUndefined();
    later = () => ({ turn: 'enabled' });
    expect((await late({})).turn).toBe('enabled');
});

// A hole of a sparse array stays one, and a slot written `undefined` a slot,
// which `reduce` and `in` tell apart: filled, the array was walked two slots
// more, on the server's page and in the browser alike.
test.for([
    ['JSON', viaJson],
    ['the page’s script', viaScript]
])('a sparse array holding Python values keeps its holes, by %s', async ([, via]) => {
    const sparse = new Array(5);
    const slots = (array) => [array.length, Object.keys(array).join(' '), array.reduce((count) => count + 1, 0)];

    sparse[1] = one;
    sparse[3] = two;
    sparse[4] = undefined;

    const server = await serverLoad(() => ({ sparse }))({});
    const browser = via({ type: 'data', data: { sparse }, uses: {} }).data;

    expect([slots(server.sparse), slots(browser.sparse)]).toEqual([
        [5, '1 3 4', 3],
        [5, '1 3 4', 3]
    ]);
    expect(browser.sparse[3].list).toBe(browser.sparse[1].list);
});

// A JavaScript container around Python values crosses as SvelteKit writes it
// with the application's own transport after ours: one its transporters write,
// a subclass of Map, made again by their decoder, on the server's page, in the
// browser and with no engine there; an object with no prototype with none; and
// what the values share shared still, across the two.
class Ledger extends Map {
    label() {
        return `ledger:${this.size}`;
    }
}

const ledgers = { Ledger: { encode: (value) => value instanceof Ledger && [...value], decode: (entries) => new Ledger(entries) } };

// As SvelteKit's `init_transport` writes and reads with them: what the server
// writes, and what the browser reads of it.
const kitWays = (given) => {
    const all = { svelthon: { encode, decode }, ...given };
    const encoders = Object.fromEntries(Object.entries(all).map(([key, one]) => [key, one.encode]));
    const decoders = Object.fromEntries(Object.entries(all).map(([key, one]) => [key, one.decode]));
    const replacer = (thing) => {
        for (const key of Object.keys(all)) {
            const made = all[key].encode(thing);

            if (made) return `app.decode('${key}', ${devalue.uneval(made, replacer)})`;
        }
    };

    return {
        JSON: [(value) => devalue.stringify(value, encoders), (text) => devalue.parse(text, decoders)],
        script: [(value) => devalue.uneval(value, replacer), (text) => new Function('app', `return ${text}`)({ decode: (key, made) => decoders[key](made) })]
    };
};

test.for(['JSON', 'script'])('a JavaScript container around Python values crosses as the application’s transport writes it, by %s', async (way) => {
    const read = ({ ledger, table }) => [
        ledger instanceof Ledger && ledger.label(),
        Object.getPrototypeOf(table),
        Object.keys(table).join(' '),
        ledger.get('a') === table.a,
        ledger.get('b').list === table.a.list
    ];
    const [write, readBack] = kitWays(ledgers)[way];
    const codec = globalThis[CODEC];
    const expected = ['ledger:2', null, 'a b', true, true];

    applicationTransport(ledgers);
    try {
        const server = await serverLoad(() => ({ ledger: new Ledger([['a', one], ['b', two]]), table: Object.assign(Object.create(null), { a: one, b: two }) }))({});
        const written = write({ type: 'data', data: server, uses: {} });

        expect(read(server)).toEqual(expected);
        expect(read(readBack(written).data)).toEqual(expected);

        // And written as SvelteKit writes an action's answer, no `load()` before.
        expect(read(readBack(write({ data: { ledger: new Ledger([['a', one], ['b', two]]), table: { __proto__: null, a: one } } })).data)).toEqual(['ledger:2', null, 'a', true, true]);

        delete globalThis[CODEC];
        try {
            expect(read(readBack(written).data)).toEqual(expected);
        } finally {
            globalThis[CODEC] = codec;
            codecLoaded();
        }
    } finally {
        applicationTransport({});
    }
});

// What a page with no engine reads beside an instance whose own state holds a
// list the data holds too is that same list, written once.
test('a copy with no engine shares what an instance’s own state shares with the data', async () => {
    const data = await routeServerLoad(kept, 'kept — transport')({});
    const made = devalue.stringify({ type: 'data', data, uses: {} }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let same;

    delete globalThis[CODEC];

    try {
        const copy = devalue.parse(made, { svelthon: decode }).data;

        same = copy.a === copy.g.items;
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect([same, made.includes('left out')]).toEqual([true, false]);
});

// An action's answer, a `fail()`'s among them, read by the page on the server
// as the browser reads it.
test('an action’s answer is read on the server as the browser reads it, a fail()’s too', async () => {
    const relayed = routeActions(pyBind(actions), 'actions — transport');
    const seen = (form) => String($B.$getattr($B.$getitem(pyBind(form), 'reduced'), 'seen'));
    const answer = await relayed.lossy({});
    const failed = await routeActions({ refused: () => ({ status: 400, data: lossy({}) }) }, 'refused — transport').refused({});

    expect([seen(answer), seen(viaScript({ form: answer }).form), seen(failed.data)]).toEqual(['kept', 'kept', 'kept']);
});

// The answer a page holds after a form's POST, decoded at hydration before the
// codec is there and first read by Python in the page's template: rebuilt in
// that reaction, a `__setstate__` filling its instance through `self.__dict__`
// was a write Svelte refused, and the page an error.
test('an action’s answer first read in a template is rebuilt outside its reaction', async () => {
    const answer = await routeActions(pyBind(actions), 'actions — transport').loaded({});
    const made = devalue.stringify({ form: answer }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let form;

    delete globalThis[CODEC];

    try {
        ({ form } = devalue.parse(made, { svelthon: decode }));
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    const target = document.body.appendChild(document.createElement('div'));

    mount(FormAnswer, { target, props: { form } });
    flushSync();
    expect(target.textContent).toBe('Loaded:Loaded(3, True)');
    target.remove();
});

// A remote function of a `.remote.py`: SvelteKit takes, of what the Python
// function answers, what the browser reads, each answer of a batched query's
// resolver and each value a live query yields included; an answer pickle will
// not carry stays itself, for SvelteKit to refuse.
test('a remote function hands SvelteKit what the browser reads of each answer', async () => {
    const declared = (fn) => fn;

    declared.batch = (fn) => fn;
    declared.live = (fn) => fn;

    const query = remoteHelper(declared);
    const seen = (answer) => String($B.$getattr($B.$getitem(pyBind(answer), 'reduced'), 'seen'));
    const resolve = await query.batch(remote_batch)([7]);
    const yielded = [];

    for await (const one of query.live(remote_live)()) yielded.push(seen(one));

    expect([seen(await query(remote_lossy)()), seen(await resolve(7, 0)), ...yielded]).toEqual(['kept', 'kept', 'kept']);
    expect(typeof (await query(remote_hook)()).hook).toBe('function');

    // In a remote request no page of the server reads the answer, written as
    // pickle writes it; and a function of JavaScript's, a validator, is left
    // as it is.
    const validator = () => true;
    const [kept, remote] = remoteHelper((validate, fn) => [validate, fn], () => true)(validator, remote_lossy);

    expect([kept === validator, seen(await remote())]).toEqual([true, 'changed']);
});

// SvelteKit renders the page with an action's answer, then writes the answer
// out: the browser reads what the action returned, an iterator the page walked
// where it stood when it was returned.
test('an action’s answer crosses as it was returned, whatever the page read of it first', async () => {
    const answer = await routeActions(pyBind(actions), 'actions — transport').default({});
    const shown = (form) => String(describe($B.$getitem(pyBind(form), 'zipped')));

    expect(shown(answer)).toBe("zip:[(2, 'b'), (3, 'c')]");
    expect(shown(viaScript({ form: answer }).form)).toBe("zip:[(2, 'b'), (3, 'c')]");
});

// An answer JavaScript edits before Python reads it, as a page's `enhance` may:
// Python reads what JavaScript left, a value replaced in its place, a key
// removed left out and one added after them, the others as they crossed.
test('an action’s answer JavaScript edited is, to Python, what JavaScript left of it', async () => {
    const answer = viaScript({ form: await routeActions(pyBind(actions), 'actions — transport').edited({}) }).form;

    answer.label = 'from client';
    delete answer.other;
    answer.added = 1;

    expect([answer.label, shown(answer)]).toEqual(['from client', "dict:{'label': 'from client', 'pair': (1, 2), 'added': 1}"]);
});

// `page.data` read from Python before the page has read its own `data`: the
// same dict, as an argument and as an attribute Python reads off JavaScript's
// `page`.
test('SvelteKit’s merge read from Python before the page’s data is the dict of what its loads returned', async () => {
    const page = viaScript({ type: 'data', data: await routeLoad(load, 'load — transport')({}) }).data;
    const merged = { ...viaJson(await routeLoad(layout, 'layout — transport')({})), ...page };
    const expected = "dict:{'both': 'page', 'first': 2.0, 'top': 1.0, 'rows': (1, 2)}";

    expect([String(describe(merged)), String(data_of({ data: { ...merged } }))]).toEqual([expected, expected]);
});

// SvelteKit's plain object of the data is its view's, which lists an iterator,
// and so uses it up: the page reads that list, on the server and in the
// browser alike.
test('an iterator at the top of a load() is the list its view made, on both sides', async () => {
    const node = await routeLoad(walked, 'walked — transport')({});
    const browser = viaScript({ type: 'data', data: node }).data;

    for (const data of [routeData({ ...node }), routeData({ ...browser })]) {
        expect(String(describe($B.$getitem(data, 'zipped')))).toBe("list:[(2, 'b'), (3, 'c')] cycle=False");
        expect(String(describe($B.$getitem(data, 'numbers')))).toBe('list:[1, 2] cycle=False');
    }
});

// SvelteKit streams a coroutine's promise and writes its value apart once it
// comes: pickled, so that the page awaits in the browser what it awaited on the
// server, `1.0` a float, while JavaScript reads the number.
test('a coroutine at the top of a load() is awaited in the browser as on the server, its result as it was', async () => {
    const made = encode(await routeLoad(streamed, 'streamed — transport')({}));
    const [, key, [tag, promise]] = made[2];
    const arrived = structuredClone(await promise);
    const browser = decode(['p', made[1], ['d', key, [tag, Promise.resolve(arrived)]], made[3]]);

    expect(String(describe(await $B.$getitem(routeData({ ...browser }), 'later')))).toBe('float:1.0');
    expect(await browser.later).toBe(1);
});

test('a value no engine can rebuild yet is JavaScript’s copy, which Python reads rebuilt', () => {
    const made = devalue.stringify({ value: viewOrSelf($B.$getitem(pyBind(values()), 'point')) }, { svelthon: encode });
    const codec = globalThis[CODEC];

    delete globalThis[CODEC];

    let copy;

    try {
        copy = devalue.parse(made, { svelthon: decode }).value;
    } finally {
        globalThis[CODEC] = codec;
    }

    expect(copy).toEqual({ x: 3 });

    // The codec there, Python reads the copy as the instance it stands for.
    codecLoaded();
    expect(String(describe(pyBind(copy)))).toBe('Point:Point(3)');
});

// The data of a `load()` JavaScript read with no engine, as SvelteKit merges
// it: each of its values Python reads as the value it stands for, one handed
// apart as a prop and the merged data alike, an alias the same instance.
test('the values of a load() read with no engine are, to Python, the values they stand for', async () => {
    const made = encode(await routeLoad(pointed, 'pointed — transport')({}));
    const codec = globalThis[CODEC];
    let item;
    let pair;
    let merged;

    delete globalThis[CODEC];

    try {
        const top = decode(made);

        [item, pair, merged] = [top.item, top.pair, { ...top }];
    } finally {
        globalThis[CODEC] = codec;
    }

    codecLoaded();

    const data = routeData(merged);
    const read = (key) => $B.$getitem(data, key);

    expect([shown(item), shown(pair), String(describe(data))]).toEqual([
        'Point:Point(7)',
        'tuple:(Point(7), 1)',
        "dict:{'item': Point(7), 'same': Point(7), 'pair': (Point(7), 1), 2: [Point(7)]}"
    ]);
    expect([pyBind(item) === read('item'), read('same') === read('item'), $B.$getitem(read('pair'), 0) === read('item')]).toEqual([
        true,
        true,
        true
    ]);
});

// JavaScript has no complex: its two parts, the view a reader on the server is
// handed and the copy a page with no engine reads alike, a subclass's too.
test.for([
    ['complex', { real: 1, imag: -2 }],
    ['money', { real: 3, imag: 4 }]
])('a %s is its two parts to JavaScript, on the server and in the copy alike', ([key, parts]) => {
    const view = viewOrSelf($B.$getitem(pyBind(values()), key));
    const made = devalue.stringify({ value: view }, { svelthon: encode });
    const codec = globalThis[CODEC];

    delete globalThis[CODEC];

    try {
        expect([view, devalue.parse(made, { svelthon: decode }).value]).toEqual([parts, parts]);
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }
});

// What a page with no engine reads of an instance of a builtin's subclass is
// what a reader on the server is handed, whatever its class hands over to
// rebuild it: a `__getnewargs__` or a `__reduce__` of its own.
test('an instance of a builtin’s subclass reads with no engine as on the server, whatever its class hands over', () => {
    const shape = (one) =>
        one instanceof Set || one instanceof Uint8Array || Array.isArray(one)
            ? `${one.constructor.name}[${[...one].join(',')}]`
            : typeof one === 'object'
              ? JSON.stringify(one)
              : `${typeof one}:${one}`;
    const keys = ['ownprice', 'tags', 'blob', 'rows', 'money'];
    const dict = pyBind(values());
    const made = devalue.stringify({ value: __pybridge.bound(dict) }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let copies;

    delete globalThis[CODEC];

    try {
        const top = devalue.parse(made, { svelthon: decode }).value;

        copies = keys.map((key) => shape(top[key]));
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect(copies).toEqual(keys.map((key) => shape(__pybridge.bound(dict)[key])));
});

// A page with no engine reads a dict's entries as its own properties, a
// `__proto__` among them, under the names the server's view gives them, and an
// instance with slots by its slots, as the view shows it.
test('a copy with no engine holds what the server’s view shows: its own entries, their names, an instance’s slots', () => {
    const dict = pyBind(values());
    const made = devalue.stringify({ value: __pybridge.bound(dict) }, { svelthon: encode });
    const view = __pybridge.bound(dict);
    const codec = globalThis[CODEC];
    let box;
    let names;
    let slotted;

    delete globalThis[CODEC];

    let dispatch;

    try {
        const top = devalue.parse(made, { svelthon: decode }).value;

        [box, names, slotted, dispatch] = [top.box, Object.keys(top.composite), { ...top.slotted }, Object.keys(top.dispatch)];
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect([Object.keys(box), Object.hasOwn(box, '__proto__'), box.inherited]).toEqual([['__proto__', 'safe'], true, undefined]);
    expect(names).toEqual(Object.keys(view.composite));
    expect(slotted).toEqual({ x: 3, y: 6 });
    expect({ ...view.slotted }).toEqual({ x: 3, y: 6 });
    expect([dispatch, Object.keys(view.dispatch)]).toEqual([
        ['int', 'Point', 'describe', 'len', 'Ellipsis'],
        ['int', 'Point', 'describe', 'len', 'Ellipsis']
    ]);
});

// And what the node does not carry, the server writes beside it as the view of
// the value the browser rebuilds shows it, the value the server's page reads
// too: an instance whose own reduction or state leaves out a field, an
// exception, a slice; Ellipsis is nothing on either side. What pickle names, a
// singleton, crosses by its name alone.
test('a copy with no engine reads what the server’s page reads of the value pickle carries', () => {
    const keys = ['reduced', 'stated', 'oops', 'cut', 'dots'];
    const shape = (one) => (one === undefined ? 'undefined' : JSON.stringify(one));
    const dict = pyBind(values());
    const rebuilt = __pybridge.bound(unpickled(pickled(dict)));
    const made = devalue.stringify({ value: __pybridge.bound(dict) }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let copies;
    let single;

    delete globalThis[CODEC];

    try {
        const top = devalue.parse(made, { svelthon: decode }).value;

        [copies, single] = [keys.map((key) => shape(top[key])), top.single];
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect(copies).toEqual(keys.map((key) => shape(rebuilt[key])));
    expect(copies).toEqual(['{"x":4,"seen":"kept"}', '{"a":1}', '{"args":["bad",2],"code":404}', '{"start":1,"step":2}', 'undefined']);
    expect([typeof single, single.name]).toEqual(['function', 'SINGLE']);
});

// And what the author's code makes of a value as it is rebuilt: a
// `__setstate__` that adds an attribute, a `__setitem__` that names a key anew.
test('a copy with no engine reads what the author’s code made of the value as it was rebuilt', () => {
    const made = devalue.stringify({ value: __pybridge.bound(pyBind(hooked())) }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let copies;

    delete globalThis[CODEC];

    try {
        const top = devalue.parse(made, { svelthon: decode }).value;

        copies = [JSON.stringify(top.loaded), JSON.stringify(top.upper)];
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect(copies).toEqual(['{"x":3,"loaded":true}', '{"A":1,"B":2}']);
});

// What only the engine runs, a page with no engine holds as a function of the
// name the server's reader sees, which says so when it is called.
test('a function, a class, a bound method or a callable instance is a function of its name with no engine', () => {
    const keys = ['function', 'klass', 'method', 'called', 'builtin'];
    const dict = pyBind(callables());
    const view = __pybridge.bound(dict);
    const made = devalue.stringify({ value: view }, { svelthon: encode });
    const codec = globalThis[CODEC];
    let copies;

    delete globalThis[CODEC];

    try {
        const top = devalue.parse(made, { svelthon: decode }).value;

        copies = Object.fromEntries(keys.map((key) => [key, top[key]]));
    } finally {
        globalThis[CODEC] = codec;
        codecLoaded();
    }

    expect(keys.map((key) => typeof copies[key])).toEqual(keys.map(() => 'function'));
    expect(keys.map((key) => copies[key].name)).toEqual(['describe', 'Gauge', 'Gauge.read', 'Gauge.__call__', 'len']);
    expect(['function', 'method', 'called', 'builtin'].map((key) => view[key].name)).toEqual(['describe', 'Gauge.read', 'Gauge.__call__', 'len']);
    expect(() => copies.method()).toThrow(/`Gauge.read` is Python's, and this page runs no Python/);
});

test('JavaScript’s own values are devalue’s, and so is a promise, which SvelteKit streams', () => {
    expect(encode({ a: 1 })).toBeUndefined();
    expect(encode([1, 2])).toBeUndefined();
    expect(encode(Promise.resolve(1))).toBeUndefined();
    expect(encode(1)).toBeUndefined();
    expect(encode('a')).toBeUndefined();
});

test('an instance of a class only the server has is refused there, with the module named', () => {
    __pybridge.serverModule('transport_vault');

    expect(() => devalue.stringify({ value: viewOrSelf($B.$call(pyBind(Vault))) }, { svelthon: encode })).toThrow(
        /`transport_vault` is a module of the server alone/
    );
});

