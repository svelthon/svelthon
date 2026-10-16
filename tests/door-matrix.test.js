// **What a value becomes through each door a mounted component opens**, the
// second half of PLAN_BRYNTIME's first step: a Python parent hands a value of
// each kind to a Python child and to a Svelte one, by name, in a spread,
// through the context or as a snippet's argument, and a Svelte parent hands
// JavaScript values to the Python child. Each side writes down what it
// received in a log of its own, outside every door.
//
// The witnesses: a Python child receives the parent's very value, whatever the
// door; a spread hands a child what the same prop written by name does. The
// cells apart from their witness are listed, the work of the plan's last step.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { describeJs } from './crossing-describe.js';
import { seen } from './fixtures/door_matrix_log.js';
import DoorMatrix from './fixtures/DoorMatrix.svelte';
import DoorMatrixNative from './fixtures/DoorMatrixNative.svelte';

const PY_KINDS = [
    'none', 'true', 'int', 'big', 'float-int', 'float', 'str', 'astral', 'str-sub', 'bytes',
    'list', 'tuple', 'dict', 'set', 'frozenset', 'instance', 'function', 'method', 'class', 'builtin'
];

// Which line of the log a door writes: the parent's own, the Python child's
// prop or context, the Svelte child's prop or context.
const SIDE = {
    parent: 'parent',
    name: 'python',
    spread: 'python',
    context: 'python-context',
    snippet: 'python',
    'js-name': 'js',
    'js-spread': 'js',
    'js-context': 'js-context'
};

const JS_VALUES = () => ({
    undefined: undefined,
    null: null,
    true: true,
    int: 7,
    float: 0.5,
    nan: NaN,
    big: 2n ** 70n,
    str: 'a',
    astral: '\u{1F600}',
    object: { a: 1 },
    array: [1, [2]],
    accessor: {
        get n() {
            return 1;
        }
    },
    'class-instance': new (class Thing {
        n = 1;
    })(),
    date: new Date(0),
    map: new Map([[1, 2]]),
    set: new Set([1]),
    bytes: new Uint8Array([1, 2]),
    function: function named() {},
    'symbol-key': { [Symbol('s')]: 1, a: 1 },
    promise: Promise.resolve(1)
});

const received = (Component, props, side) => {
    seen.length = 0;

    const target = document.body.appendChild(document.createElement('div'));

    try {
        const app = mount(Component, { target, props });

        flushSync();
        unmount(app);

        const one = seen.find(([which]) => which === side);

        if (one === undefined) return 'nothing';

        return side.startsWith('js') ? describeJs(one[1]) : String(one[1]);
    } finally {
        target.remove();
    }
};

const row = (door) =>
    door.startsWith('from-')
        ? Object.fromEntries(
              Object.keys(JS_VALUES()).map((kind) => [
                  kind,
                  received(DoorMatrixNative, { value: JS_VALUES()[kind], door: door.slice(5) }, 'python')
              ])
          )
        : Object.fromEntries(
              PY_KINDS.map((kind) => [kind, received(DoorMatrix, { kind, door: door === 'parent' ? 'name' : door }, SIDE[door])])
          );

const apart = (one, other) => Object.keys(one).filter((kind) => one[kind] !== other[kind]);

// What the Python parent holds, as Python writes it: its type, and its repr
// when that holds no address.
const PARENT = {
    none: 'NoneType:None', true: 'bool:True', int: 'int:7', big: 'int:1180591620717411303424',
    'float-int': 'float:15.0', float: 'float:0.5', str: "str:'a'", astral: "str:'😀'", 'str-sub': "Text:'t'",
    bytes: "bytes:b'ab'", list: 'list:[1, [2]]', tuple: 'tuple:(1, 2)', dict: "dict:{'a': 1, 2: 'b'}",
    set: 'set:{1}', frozenset: 'frozenset:frozenset({1})', instance: 'Box', function: 'function',
    method: 'method', class: 'type', builtin: 'builtin_function_or_method'
};

// What a Svelte child reads of the same values handed by name.
const SVELTE_CHILD = {
    none: '"absent"', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
    str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'Uint8Array', list: 'view [1, view [2]]',
    tuple: 'view [1, 2]', dict: 'view {2: "b", a: 1}', set: 'SetView', frozenset: 'SetView',
    instance: 'view {n: 1}', function: 'function', method: 'function', class: 'python type', builtin: 'function'
};

// What the Python child reads of JavaScript values a Svelte parent hands it.
const FROM_SVELTE = {
    undefined: "str:'absent'", null: 'NoneType:None', true: 'bool:True', int: 'int:7', float: 'float:0.5',
    nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
    object: 'JSObject', array: 'JavascriptArray', accessor: 'JSObject', 'class-instance': 'JSObject',
    date: 'JSObject', map: 'IterableJavascriptObject', set: 'IterableJavascriptObject',
    bytes: 'IterableJavascriptObject', function: 'JavascriptFunction', 'symbol-key': 'JSObject',
    promise: 'JSObject'
};

test.for([['parent', PARENT], ['js-name', SVELTE_CHILD], ['from-js-name', FROM_SVELTE]])(
    'the %s line crosses each kind of value as it does today',
    ([door, expected]) => {
        expect(row(door)).toEqual(expected);
    }
);

// A Python child receives the parent's very value, by every door.
test.for(['name', 'spread', 'context', 'snippet'])('a Python child receives the value itself, %s', (door) => {
    expect(apart(row(door), PARENT)).toEqual([]);
});

// A Svelte child receives in a spread what it receives by name; through the
// context, None is `null` where by name it is the absence its default fills.
test.for([
    ['js-spread', 'js-name', []],
    ['js-context', 'js-name', ['none']],
    ['from-js-spread', 'from-js-name', []]
])('%s differs from %s on these kinds, and these alone', ([door, witness, kinds]) => {
    expect(apart(row(door), row(witness))).toEqual(kinds);
});
