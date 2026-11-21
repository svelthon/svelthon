// @vitest-environment node
//
// **What each door does to each kind of value, as the code does it today.** The
// first step of PLAN_BRYNTIME: the doors a value crosses between Python and
// JavaScript, the ones reached without mounting a component, each read on every
// kind of value. A change of any cell is a change of a door, and shows here.
//
// Where a door has a witness, the cells that differ from it are listed, the work
// of the plan's last step and of no step before it. `to_js` has one in its own
// contract: a copy of what JavaScript otherwise reads through the view.
import { test, expect } from 'vitest';
import '../src/lib/compile.js';
import { pyData, pyExpression } from '../src/lib/bridge.js';
import { toJs, toPython } from 'bryntime';
import { to_json } from 'brylters';
import { describeJs } from './crossing-describe.js';

const $B = globalThis.__BRYTHON__;

const SOURCE = `
class Box:
    def __init__(self, n):
        self.n = n

    def get(self):
        return self.n


class Text(str):
    pass


def function(x):
    return x


VALUES = {
    "none": None, "true": True, "int": 7, "big": 2 ** 70, "float-int": 15.0, "float": 0.5,
    "str": "a", "astral": "\\U0001F600", "str-sub": Text("t"), "bytes": b"ab",
    "list": [1, [2]], "tuple": (1, 2), "dict": {"a": 1, 2: "b"}, "set": {1}, "frozenset": frozenset({1}),
    "instance": Box(1), "function": function, "method": Box(1).get, "class": Box, "builtin": len,
}


def get(kind):
    return VALUES[kind]


def boxed(kind):
    return {"v": VALUES[kind]}


def listed(kind):
    return [VALUES[kind]]


def describe(value):
    return f"{type(value).__name__}:{value!r}"
`;

const compiled = $B.py2js({ src: SOURCE, filename: 'crossing_kinds.py' }, 'crossing_kinds', ['crossing_kinds']).to_js();
const kinds = new Function(`${compiled}\nreturn locals_crossing_kinds_py;`)();

const PY_KINDS = [
    'none', 'true', 'int', 'big', 'float-int', 'float', 'str', 'astral', 'str-sub', 'bytes',
    'list', 'tuple', 'dict', 'set', 'frozenset', 'instance', 'function', 'method', 'class', 'builtin'
];

// A Python value written out by Python: its type and its repr, a `String`
// object when it leaves the BMP, read as the text it holds. Without the
// identity a default repr names, `at 0x…`, which differs from run to run.
const describePy = (value) => String($B.$call(kinds.describe, value)).replace(/ at 0x[0-9a-f]+/, '');

const cell = (cross, describe) => {
    try {
        return describe(cross());
    } catch (error) {
        return `raises ${error?.__class__ ? $B.class_name(error) : (error?.name ?? 'error')}`;
    }
};

const expression = (kept) => pyExpression((args) => kinds.get(...args), 'crossing-matrix', 1, kept);

// Python to JavaScript: `to_js`, a scalar made JavaScript's, what a template
// expression renders, an item read through a view, a key of a spread to a
// JavaScript child and to a Python one, what an `@export` returns, and what a
// template expression gives Svelte by the kind of its reader.
// Each row opened by its door's name, so a door registered under the wrong
// rule changes its row.
const TO_JS = {
    plainData: (kind) => toJs($B.$getitem(kinds.VALUES, kind), 'copy'),
    plainScalar: (kind) => toJs($B.$getitem(kinds.VALUES, kind), 'scalar'),
    pyNumbers: (kind) => toJs($B.$getitem(kinds.VALUES, kind), 'expression'),
    'view-read': (kind) => toJs($B.$call(kinds.listed, kind), 'attribute')[0],
    spread: (kind) => toJs($B.$call(kinds.boxed, kind), 'spread').v,
    spreadPython: (kind) => toJs($B.$call(kinds.boxed, kind), 'spread-python').v,
    pyExport: (kind) => toJs($B.$getitem(kinds.VALUES, kind), 'export', 'crossing-matrix'),
    expression: (kind) => expression(false)(kind),
    'expression-python': (kind) => expression(true)(kind),
    'expression-child': (kind) => expression('child')(kind),
    'expression-scalar': (kind) => expression('scalar')(kind),
    'expression-selection': (kind) => expression('selection')(kind)
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

// JavaScript to Python: a binding's value, `to_py`, an object written into a
// container (`entering`), an argument of a `load` or an action, and a push
// into a list's view.
const TO_PY = {
    pyBind: (value) => toPython(value, 'binding'),
    pyData: (value) => toPython(value, 'copy'),
    'pyData-live': (value) => toPython(value, 'copy', undefined, true),
    pyArg: (value) => toPython(value, 'load'),
    'view-write': (value) => {
        const list = pyData([]);

        toJs(list, 'attribute').push(value);

        return list[0];
    }
};

const row = (door) =>
    door in TO_JS
        ? Object.fromEntries(PY_KINDS.map((kind) => [kind, cell(() => TO_JS[door](kind), describeJs)]))
        : Object.fromEntries(Object.keys(JS_VALUES()).map((kind) => [kind, cell(() => TO_PY[door](JS_VALUES()[kind]), describePy)]));

const PYTHON_REFUSED = 'python builtin_function_or_method';
const PYTHON_NONE = 'python NoneType';

const MATRIX = {
    plainData: {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
        str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'Uint8Array', list: '[1, [2]]', tuple: '[1, 2]',
        dict: '{2: "b", a: 1}', set: 'Set', frozenset: 'Set', instance: '{n: 1}',
        function: 'function', method: 'function', class: 'python type', builtin: 'function'
    },
    plainScalar: {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
        str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'python bytes', list: 'python list',
        tuple: 'python tuple', dict: 'python dict', set: 'python set', frozenset: 'python frozenset',
        instance: 'python Box', function: 'python function', method: 'python method', class: 'python type',
        builtin: PYTHON_REFUSED
    },
    pyNumbers: {
        none: PYTHON_NONE, true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15',
        float: '0.5', str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'python bytes', list: 'python list',
        tuple: 'python tuple', dict: 'python dict', set: 'python set', frozenset: 'python frozenset',
        instance: 'python Box', function: 'python function', method: 'python method', class: 'python type',
        builtin: PYTHON_REFUSED
    },
    'view-read': {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
        str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'Uint8Array', list: 'view [1, view [2]]',
        tuple: 'view [1, 2]', dict: 'view {2: "b", a: 1}', set: 'SetView', frozenset: 'SetView',
        instance: 'view {n: 1}', function: 'function', method: 'function', class: 'python type', builtin: 'function'
    },
    spread: {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
        str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'Uint8Array', list: 'view [1, view [2]]',
        tuple: 'view [1, 2]', dict: 'view {2: "b", a: 1}', set: 'SetView', frozenset: 'SetView',
        instance: 'view {n: 1}', function: 'function', method: 'function', class: 'python type', builtin: 'function'
    },
    spreadPython: {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': 'python float',
        float: 'python float', str: '"a"', astral: 'python str', 'str-sub': 'python Text', bytes: 'Uint8Array',
        list: 'view [1, view [2]]', tuple: 'view [1, 2]', dict: 'view {2: "b", a: 1}', set: 'SetView',
        frozenset: 'SetView', instance: 'view {n: 1}', function: 'function', method: 'function', class: 'python type',
        builtin: 'function'
    },
    pyExport: {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15', float: '0.5',
        str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'Uint8Array', list: 'view [1, view [2]]',
        tuple: 'view [1, 2]', dict: 'view {2: "b", a: 1}', set: 'SetView', frozenset: 'SetView',
        instance: 'view {n: 1}', function: 'function', method: 'function', class: 'python type', builtin: 'function'
    },
    expression: {
        none: PYTHON_NONE, true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15',
        float: '0.5', str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'python bytes', list: 'python list',
        tuple: 'python tuple', dict: 'python dict', set: 'python set', frozenset: 'python frozenset',
        instance: 'python Box', function: 'python function', method: 'python method', class: 'python type',
        builtin: PYTHON_REFUSED
    },
    'expression-python': {
        none: PYTHON_NONE, true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': 'python float',
        float: 'python float', str: '"a"', astral: 'python str', 'str-sub': 'python Text', bytes: 'python bytes',
        list: 'python list', tuple: 'python tuple', dict: 'python dict', set: 'python set',
        frozenset: 'python frozenset', instance: 'python Box', function: 'python function', method: 'python method',
        class: 'python type', builtin: PYTHON_REFUSED
    },
    // A prop a Python child is handed: the Python value, None the absence.
    'expression-child': {
        none: 'undefined', true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': 'python float',
        float: 'python float', str: '"a"', astral: 'python str', 'str-sub': 'python Text', bytes: 'python bytes',
        list: 'python list', tuple: 'python tuple', dict: 'python dict', set: 'python set',
        frozenset: 'python frozenset', instance: 'python Box', function: 'python function', method: 'python method',
        class: 'python type', builtin: PYTHON_REFUSED
    },
    'expression-scalar': {
        none: PYTHON_NONE, true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15',
        float: '0.5', str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'python bytes', list: 'python list',
        tuple: 'python tuple', dict: 'python dict', set: 'python set', frozenset: 'python frozenset',
        instance: 'python Box', function: 'python function', method: 'python method', class: 'python type',
        builtin: PYTHON_REFUSED
    },
    'expression-selection': {
        none: PYTHON_NONE, true: 'true', int: '7', big: '1180591620717411303424n', 'float-int': '15',
        float: '0.5', str: '"a"', astral: '"😀"', 'str-sub': '"t"', bytes: 'python bytes', list: '[1, python list]',
        tuple: '[1, 2]', dict: 'python dict', set: 'python set', frozenset: 'python frozenset',
        instance: 'python Box', function: 'python function', method: 'python method', class: 'python type',
        builtin: PYTHON_REFUSED
    },
    pyBind: {
        undefined: 'NoneType:None', null: 'NullType:<Javascript null>', true: 'bool:True', int: 'int:7', float: 'float:0.5',
        nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
        object: 'JSObject:<Javascript object: [object Object]>', array: 'JavascriptArray:[1, [2]]',
        accessor: 'JSObject:<Javascript object: [object Object]>',
        'class-instance': 'JSObject:<Javascript object: [object Object]>',
        date: 'JSObject:<Javascript object: [object Date]>',
        map: 'IterableJavascriptObject:<Javascript object: [object Map]>',
        set: 'IterableJavascriptObject:<Javascript object: [object Set]>',
        bytes: 'IterableJavascriptObject:<Javascript object: [object Uint8Array]>',
        function: 'JavascriptFunction:<JavascriptFunction object>',
        'symbol-key': 'JSObject:<Javascript object: [object Object]>',
        promise: 'JSObject:<Javascript object: [object Promise]>'
    },
    pyData: {
        undefined: 'NoneType:None', null: 'NullType:<Javascript null>', true: 'bool:True', int: 'int:7', float: 'float:0.5',
        nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
        object: "dict:{'a': 1}", array: 'list:[1, [2]]', accessor: "dict:{'n': 1}",
        'class-instance': 'JSObject:<Javascript object: [object Object]>',
        date: 'JSObject:<Javascript object: [object Date]>',
        map: 'IterableJavascriptObject:<Javascript object: [object Map]>',
        set: 'IterableJavascriptObject:<Javascript object: [object Set]>',
        bytes: 'IterableJavascriptObject:<Javascript object: [object Uint8Array]>',
        function: 'JavascriptFunction:<JavascriptFunction object>',
        'symbol-key': "dict:{'a': 1, <Javascript object: [object Symbol]>: 1}",
        promise: 'JSObject:<Javascript object: [object Promise]>'
    },
    'pyData-live': {
        undefined: 'NoneType:None', null: 'NullType:<Javascript null>', true: 'bool:True', int: 'int:7', float: 'float:0.5',
        nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
        object: "dict:{'a': 1}", array: 'list:[1, [2]]', accessor: 'JSObject:<Javascript object: [object Object]>',
        'class-instance': 'JSObject:<Javascript object: [object Object]>',
        date: 'JSObject:<Javascript object: [object Date]>',
        map: 'IterableJavascriptObject:<Javascript object: [object Map]>',
        set: 'IterableJavascriptObject:<Javascript object: [object Set]>',
        bytes: 'IterableJavascriptObject:<Javascript object: [object Uint8Array]>',
        function: 'JavascriptFunction:<JavascriptFunction object>',
        'symbol-key': "dict:{'a': 1, <Javascript object: [object Symbol]>: 1}",
        promise: 'JSObject:<Javascript object: [object Promise]>'
    },
    pyArg: {
        undefined: 'NoneType:None', null: 'NullType:<Javascript null>', true: 'bool:True', int: 'int:7', float: 'float:0.5',
        nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
        object: 'JSObject:<Javascript object: [object Object]>', array: 'JavascriptArray:[1, [2]]',
        accessor: 'JSObject:<Javascript object: [object Object]>',
        'class-instance': 'JSObject:<Javascript object: [object Object]>',
        date: 'JSObject:<Javascript object: [object Date]>',
        map: 'IterableJavascriptObject:<Javascript object: [object Map]>',
        set: 'IterableJavascriptObject:<Javascript object: [object Set]>',
        bytes: 'IterableJavascriptObject:<Javascript object: [object Uint8Array]>',
        function: 'JavascriptFunction:<JavascriptFunction object>',
        'symbol-key': 'JSObject:<Javascript object: [object Object]>',
        promise: 'JSObject:<Javascript object: [object Promise]>'
    },
    'view-write': {
        undefined: 'NoneType:None', null: 'NullType:<Javascript null>', true: 'bool:True', int: 'int:7', float: 'float:0.5',
        nan: 'float:nan', big: 'int:1180591620717411303424', str: "str:'a'", astral: "str:'😀'",
        object: "dict:{'a': 1}", array: 'list:[1, [2]]', accessor: 'JSObject:<Javascript object: [object Object]>',
        'class-instance': 'JSObject:<Javascript object: [object Object]>',
        date: 'JSObject:<Javascript object: [object Date]>',
        map: 'IterableJavascriptObject:<Javascript object: [object Map]>',
        set: 'IterableJavascriptObject:<Javascript object: [object Set]>',
        bytes: 'IterableJavascriptObject:<Javascript object: [object Uint8Array]>',
        function: 'JavascriptFunction:<JavascriptFunction object>',
        'symbol-key': "dict:{'a': 1, <Javascript object: [object Symbol]>: 1}",
        promise: 'JSObject:<Javascript object: [object Promise]>'
    }
};

test.for(Object.keys(MATRIX))('the %s door crosses each kind of value as it does today', (door) => {
    expect(row(door)).toEqual(MATRIX[door]);
});

// `to_js` against its witness, the view it copies: on every kind the copy is
// what JavaScript reads through the view, a set a `Set` and a callable a
// function that takes the arguments it declares. A set stayed a Python set, a
// bound method became `{}`, and a function stayed the engine's own, which took
// every argument JavaScript passed.
test('to_js is a copy of what the view reads, on every kind', () => {
    const copy = row('plainData');
    const view = row('view-read');
    const copied = (text) => text.replaceAll('view ', '').replace('SetView', 'Set');

    expect(PY_KINDS.filter((kind) => copied(view[kind]) !== copy[kind])).toEqual([]);
});

// The None column: None is `undefined` at every door that hands JavaScript a
// value, the engine's pairing (`pyobj2jsobj`), `null` being `javascript.NULL`'s,
// and `null` in JSON alone, `to_json`'s. A door that hands Python's own value
// to a Python reader keeps None. A context, a key and a `{@debug}` copy, which
// no row above opens, alike. And the way in: `undefined` is None and `null`
// the `javascript.NULL` it is, at every door.
test('None is undefined at every door to JavaScript, and null in JSON alone', () => {
    const none = $B.builtins.None;
    const cells = Object.fromEntries(Object.keys(TO_JS).map((door) => [door, row(door).none]));

    expect(Object.keys(cells).filter((door) => cells[door] !== 'undefined' && cells[door] !== PYTHON_NONE)).toEqual([]);
    // A prop is Svelte's door whatever the child's language: a Python child is
    // handed None as the absence its default fills.
    expect([cells.spreadPython, cells['expression-child']]).toEqual(['undefined', 'undefined']);
    expect([toJs(none, 'context'), toJs(none, 'key'), toJs(none, 'debug')]).toEqual([undefined, undefined, undefined]);
    expect(to_json(none)).toBe('null');

    const entering = Object.keys(TO_PY).filter((door) => {
        const one = row(door);

        return one.undefined !== 'NoneType:None' || one.null !== 'NullType:<Javascript null>';
    });

    expect(entering).toEqual([]);
});
