// @vitest-environment node
//
// The template helpers, called directly.
//
// Every one of them is already exercised through a mounted component
// (`tests/dates.test.js`, `fromnow`, `slugs`, `urls`, `batch`, `from-json`,
// `stripped`), and this file does not repeat that work. It goes after what a
// component cannot reach: the refusals, the branch a fixture would have to be
// built around, and the arguments Python spells `None`.
//
// It is also what makes them *visible*. They used to be strings of JavaScript in
// `injected.cjs`, so no coverage tool could instrument a line of them. Now they
// are a module, and this is the file that reads it.
//
// Node rather than jsdom on purpose: `striptags` has a branch that only exists
// where there is no DOM, and that branch is the whole server story.
import { test, expect, describe } from 'vitest';

import { runInNewContext } from 'node:vm';
import { NONE, __pybridge } from '../src/lib/runtime.js';
import {
    batch,
    date,
    from_json,
    fromnow,
    helpers,
    slugify,
    striptags,
    tojson,
    urlencode
} from '../src/lib/helpers.js';
// The calls are written in Python, which is where the helper is called from.
import { says, control, keeps_an_instance, coroutine_says } from './fixtures/tojson_calls.py';
import { shapes } from './fixtures/json_space.py';

// The Python values that are objects rather than primitives, which is what these
// helpers keep meeting: a float, a list, a tuple, a set.
const _b_ = globalThis.__BRYTHON__.builtins;

describe('the set itself', () => {
    // The object the generated script binds. A helper added to the module and
    // forgotten here would be invisible to every component.
    test('every exported helper is in the object the compiler binds', () => {
        const exported = { batch, date, from_json, fromnow, slugify, striptags, tojson, urlencode };

        expect(Object.keys(helpers).sort()).toEqual(Object.keys(exported).sort());

        // Not identity any more, and the reason is the point: what the compiler
        // binds is the *keyword-aware* helper, since Python calls these by name
        // as well as by position and JavaScript has no notion of that. The
        // adapter keeps the name and the arity, so a wiring mistake still shows
        // — a key pointing at the wrong helper fails both.
        for (const [name, fn] of Object.entries(exported)) {
            expect(helpers[name].name).toBe(fn.name);
            expect(helpers[name].length).toBe(fn.length);
        }
    });
});

describe('tojson', () => {
    test('a Python container goes out as plain JSON', () => {
        expect(tojson(__pybridge.list([1, 2]))).toBe('[1,2]');
    });

    test('a numeric indent is honoured', () => {
        expect(tojson(__pybridge.list([1])).length).toBeLessThan(tojson(__pybridge.list([1]), 2).length);
        expect(tojson(__pybridge.list([1]), 2)).toBe('[\n  1\n]');
    });

    // The one refusal that arrives without an object around it. JSON has no
    // notation for `NaN` or `±Infinity`, so `JSON.stringify` writes `null`:
    // a page said `null` where the model held a division by zero, which is a
    // different value and nothing said so.
    //
    // CPython writes `NaN` and `Infinity`, which is not JSON either — the
    // `JSON.parse` on the other side of the page refuses both — so there is no
    // answer to hand over quietly. Measured at every depth, because a replacer
    // sees the root and the members by the same route and a rule written for one
    // of them has been the shape of three defects in this file.
    test.for([
        ['bare', (one) => one],
        ['in a list', (one) => __pybridge.list([one])],
        ['under a key', (one) => __pybridge.list([__pybridge.list([one])])]
    ])('a non-finite number %s is refused, not written as null', ([, wrap]) => {
        for (const one of [NaN, Infinity, -Infinity]) {
            expect(() => tojson(wrap(one))).toThrow(/has no JSON/);
        }

        // The witness beside it: a finite float still crosses.
        expect(tojson(wrap(0.25))).toContain('0.25');
    });

    // Python's None is an object, and `JSON.stringify(v, null, None)` would
    // quietly indent with it. Anything that is not a number is dropped.
    test('None as the indent means no indent, not indent-with-None', () => {
        expect(tojson(__pybridge.list([1]), NONE)).toBe('[1]');
        expect(tojson(__pybridge.list([1]), 'two')).toBe('[1]');
    });

    // A Python int above 2^53 is a JavaScript BigInt, which `JSON.stringify`
    // refuses outright: `Do not know how to serialize a BigInt`, out of a
    // template filter, where `json.dumps` writes the digits. Svelthon renders
    // this very number on its front page, so it was refused in one place only.
    //
    // The expected text is `json.dumps`'s, character for character.
    test('a big integer is written as digits, the way json.dumps writes it', () => {
        const big = 2n ** 70n;

        expect(tojson(big)).toBe('1180591620717411303424');
        expect(tojson(__pybridge.list([big]))).toBe('[1180591620717411303424]');
    });

    // A class has no JSON, and it reaches here whole since `plainData` stopped
    // flattening one: handing it over is right at the boundary, where JavaScript
    // can call it, and wrong in a page. A Brython class carries its own
    // `__mro__`, which contains itself, so the answer was V8's `Converting
    // circular structure to JSON`, which names nothing and points at no line.
    //
    // Python's own is `Object of type type is not JSON serializable`, and this
    // one goes further by naming the class.
    test.for([
        ['on its own', (cls) => cls],
        ['inside a list', (cls) => _b_.list.$factory([cls])],
        ['inside a dict', (cls) => {
            const d = _b_.dict.$factory();
            globalThis.__BRYTHON__.$setitem(d, 'cls', cls);
            return d;
        }]
    ])('a class %s is refused by name, not by V8', ([, wrap]) => {
        // A builtin rather than one compiled here: `pyClass` reads the shape, and
        // `list` carries the same `ob_type`, `tp_name` and `tp_bases` an authored
        // class does. Measured, so the shortcut is a fact rather than a hope.
        const cls = _b_.list;

        expect(() => tojson(wrap(cls))).toThrow(/svelthon — tojson\(\)/);
        expect(() => tojson(wrap(cls))).toThrow(/list/);
        expect(() => tojson(wrap(cls))).not.toThrow(/circular structure/);
    });

    test('and beside a None, which is the same crossing twice', () => {
        const $B = globalThis.__BRYTHON__;
        const table = $B.builtins.dict.$factory();

        $B.$setitem(table, 'none', NONE);
        $B.$setitem(table, 'big', 2n ** 70n);

        expect(tojson(table)).toBe('{"none":null,"big":1180591620717411303424}');
    });

    // A str holding a character past U+FFFF is a `String` object in Brython,
    // made by `$B.String` to keep where its surrogate pairs fall, and the
    // conversion read only a subclass's storage: `tojson("🌍")` answered *🌍 is a
    // str, and a str has no JSON*. The expected text is `json.dumps`'s with
    // `ensure_ascii=False`, as `JSON.stringify` writes it.
    test.for([
        ['on its own', (text) => text, '"🌍"'],
        ['inside a list', (text) => _b_.list.$factory(['before', text]), '["before","🌍"]'],
        ['inside a dict', (text) => {
            const d = _b_.dict.$factory();
            globalThis.__BRYTHON__.$setitem(d, 'café', text);
            return d;
        }, '{"café":"🌍"}']
    ])('a str past U+FFFF %s is written as text', ([, wrap, json]) => {
        const text = globalThis.__BRYTHON__.String('🌍');

        expect(text).toBeInstanceOf(String);
        expect(tojson(wrap(text))).toBe(json);
    });

    // What the serialiser writes by the engine's own slot, and not by the
    // object's properties. `JSON.rawJSON` was copied out as `{"rawJSON": …}`,
    // its slot left behind; a String, a Number or a Boolean object was refused
    // as having no JSON of its own, while `JSON.stringify` writes its primitive.
    // Built in this context and in another one, since the slot is what tells.
    const other = (code) => runInNewContext(code);

    test.for([
        ['a raw JSON text', () => JSON.rawJSON('9007199254740993'), '9007199254740993'],
        ['a String object', () => new String('é'), '"é"'],
        ['a Number object', () => new Number(0.25), '0.25'],
        ['a Boolean object', () => new Boolean(false), 'false'],
        ['a BigInt object', () => Object(2n ** 70n), '1180591620717411303424'],
        ['a Number object of another context', () => other('new Number(0.25)'), '0.25'],
        ['a Boolean object of another context', () => other('new Boolean(false)'), 'false']
    ])('%s is written as the serialiser writes it, alone and held', ([, make, json]) => {
        expect(tojson(make())).toBe(json);
        expect(tojson({ held: make() })).toBe(`{"held":${json}}`);
    });

    // Recognised by the slot and converted as the serialiser converts: a Number
    // by `ToNumber` and a String by `ToString`, which run the author's
    // conversions, a Boolean by its slot. The primitive held used to be written
    // whatever the conversion said, and the kind was read off the tag, so a
    // Number tagged `Money` was refused.
    const tagged = (box, tag) => Object.defineProperty(box, Symbol.toStringTag, { value: tag });

    test.for([
        ['a Number with its own valueOf', () => Object.assign(new Number(1), { valueOf: () => 9 }), '9'],
        ['a Number with its own toPrimitive', () => Object.assign(new Number(1), { [Symbol.toPrimitive]: () => 9 }), '9'],
        ['a String with its own toString', () => Object.assign(new String('one'), { toString: () => 'nine' }), '"nine"'],
        ['a Boolean with its own valueOf', () => Object.assign(new Boolean(false), { valueOf: () => true }), 'false'],
        ['a Number tagged otherwise', () => tagged(new Number(1), 'Money'), '1'],
        ['a String tagged otherwise', () => tagged(new String('one'), 'Token'), '"one"'],
        ['a Boolean tagged otherwise', () => tagged(new Boolean(false), 'Flag'), 'false'],
        ['an object that only carries the tag', () => tagged({ amount: 1 }, 'Number'), '{"amount":1}']
    ])('%s is written as JSON.stringify writes it', ([, make, json]) => {
        expect(JSON.stringify(make())).toBe(json);
        expect(tojson(make())).toBe(json);
        expect(tojson({ held: make() })).toBe(`{"held":${json}}`);
    });

    // A tag a getter gives is the author's code, which the serialiser never
    // runs, so telling a boxed scalar from an object does not run it either.
    const taggedBy = (box, tag) => {
        let reads = 0;
        const value = Object.defineProperty(box, Symbol.toStringTag, {
            get: () => {
                reads += 1;
                return tag(value);
            }
        });
        return { value, reads: () => reads };
    };

    // And a tag a proxy's trap gives, with no descriptor to say so.
    const trapped = (tag) => {
        let reads = 0;
        const target = { answer: 1 };
        const value = new Proxy(target, {
            get: (on, key, receiver) => {
                if (key !== Symbol.toStringTag) return Reflect.get(on, key, receiver);
                reads += 1;
                return tag(target);
            }
        });
        return { value, reads: () => reads };
    };

    test.for([
        ['an object whose tag changes a field', () => taggedBy({ answer: 1 }, (value) => (value.answer += 1, 'Object'))],
        ['an object whose tag deletes a field', () => taggedBy({ answer: 1 }, (value) => (delete value.answer, 'Object'))],
        ['an object whose tag raises', () => taggedBy({ answer: 1 }, () => { throw new Error('read'); })],
        ['a Number whose tag raises', () => taggedBy(new Number(1), () => { throw new Error('read'); })],
        ['a proxy whose trap changes a field', () => trapped((target) => (target.answer += 1, 'Object'))],
        ['a proxy whose trap deletes a field', () => trapped((target) => (delete target.answer, 'Object'))],
        ['a proxy whose trap raises', () => trapped(() => { throw new Error('read'); })]
    ])('%s has its tag read as JSON.stringify reads it', ([, make]) => {
        const native = make();
        const json = JSON.stringify(native.value);

        for (const write of [(value) => tojson(value), (value) => tojson({ held: value }).slice(8, -1)]) {
            const one = make();

            expect(write(one.value)).toBe(json);
            expect(one.reads()).toBe(native.reads());
        }
    });

    // One of the four is converted by its own `valueOf` or `toString` as often
    // as the serialiser converts it: once, at its turn.
    const converting = (box, name, answer) => {
        let calls = 0;
        const value = Object.assign(box, {
            [name]: () => {
                calls += 1;
                return answer;
            }
        });
        return { value, calls: () => calls };
    };

    test.for([
        ['a Number', () => converting(new Number(1), 'valueOf', 9)],
        ['a String', () => converting(new String('one'), 'toString', 'nine')],
        ['a Number of a class of its own', () => converting(new (class Money extends Number {})(1), 'valueOf', 9)],
        ['a Number given a plain prototype', () => converting(Object.setPrototypeOf(new Number(1), Object.prototype), 'valueOf', 9)],
        ['a Number of another context', () => converting(other('new Number(1)'), 'valueOf', 9)]
    ])('%s is converted as often as JSON.stringify converts it', ([, make]) => {
        const native = make();
        const json = JSON.stringify(native.value);

        for (const write of [(value) => tojson(value), (value) => tojson({ held: value }).slice(8, -1)]) {
            const one = make();

            expect(write(one.value)).toBe(json);
            expect(one.calls()).toBe(native.calls());
        }
    });

    // What the serialiser reads of an array and of a hook, and nothing more. An
    // array is its indices, whatever its own iterator yields or raises; a
    // `toJSON` is read once, by the serialiser, so a getter answers once. The
    // walk read the iterator, and read the hook a first time to decide.
    const counted = () => {
        let reads = 0;
        return Object.defineProperty({ kept: 1 }, 'toJSON', {
            get: () => {
                reads += 1;
                return () => ({ reads });
            }
        });
    };

    const enumerated = (second) => {
        let listings = 0;
        class Point {
            constructor() {
                this.answer = 1;
            }
            toJSON() {
                return this;
            }
        }
        return new Proxy(new Point(), {
            ownKeys: (target) => {
                listings += 1;
                if (listings > 1) second(target);
                return Reflect.ownKeys(target);
            }
        });
    };

    test.for([
        ['an array whose iterator yields other values', () => Object.assign([1, 2], { *[Symbol.iterator]() { yield 9; } })],
        ['an Array subclass whose iterator yields other values', () => new (class extends Array { *[Symbol.iterator]() { yield 9; } })(1, 2)],
        ['an array whose iterator raises', () => Object.assign([1, 2], { [Symbol.iterator]() { throw new Error('no'); } })],
        ['an array whose element getter counts its reads', () => {
            let reads = 0;
            return Object.defineProperty([0], 0, { enumerable: true, get: () => ++reads });
        }],
        ['a hook a getter gives on its first read only', () => {
            let reads = 0;
            return Object.defineProperty({ kept: 1 }, 'toJSON', { get: () => (++reads === 1 ? () => ({ selected: 9 }) : undefined) });
        }],
        ['a hook that counts its reads', counted],
        ['a class whose hook getter counts its reads', () => {
            let reads = 0;
            class Counted {
                get toJSON() {
                    reads += 1;
                    return () => ({ reads });
                }
            }
            return new Counted();
        }],
        ['a getter that gives no hook', () => Object.defineProperty({ kept: 1 }, 'toJSON', { get: () => undefined })],
        ['a getter that gives a hook only from its second read', () => {
            let reads = 0;
            return Object.defineProperty({ kept: 1 }, 'toJSON', { get: () => (++reads > 1 ? () => ({ second: 2 }) : undefined) });
        }],
        // A Proxy gives its hook by its `get` and shows no descriptor for it.
        ['a hook a Proxy gives', () => new Proxy({ kept: 1 }, {
            get: (target, key, receiver) => (key === 'toJSON' ? () => ({ selected: 9 }) : Reflect.get(target, key, receiver))
        })],
        ['a hook a Proxy gives over a class instance', () => new Proxy(new (class Kept { kept = 1; })(), {
            get: (target, key, receiver) => (key === 'toJSON' ? () => ({ selected: 9 }) : Reflect.get(target, key, receiver))
        })],
        ['a toJSON that is not a function', () => ({ toJSON: 5, kept: 1 })],
        // Each at its own turn, as the serialiser reaches it: the hook of the
        // first occurrence runs before the second is read, and a hook that
        // changes what comes after it is seen to.
        ['one object twice, whose hook getter counts', () => {
            let reads = 0;
            const one = Object.defineProperty({}, 'toJSON', { get: () => { reads += 1; return () => reads; } });
            return [one, one];
        }],
        ['a hook that changes what a later getter reads', () => {
            let state = 0;
            return {
                a: { toJSON: () => { state = 1; return 1; } },
                get b() { return state; }
            };
        }],
        ['a hook that writes a later field', () => {
            const root = { a: { toJSON: () => { root.b = 2; return 1; } }, b: 0 };
            return root;
        }],
        ['a class whose hook gives itself back', () => new (class Point { constructor() { this.x = 1; } toJSON() { return this; } })()],
        // Its keys read once, as the serialiser reads them: a proxy's `ownKeys`
        // that answers otherwise from its second call is called once.
        ['a proxied instance given back, a field added on a second listing', () => enumerated((target) => { target.extra = 2; })],
        ['a proxied instance given back, a field deleted on a second listing', () => enumerated((target) => { delete target.answer; })],
        ['a proxied instance given back, raising on a second listing', () => enumerated(() => { throw new Error('second ownKeys'); })],
        // Read at each occurrence: an object that grows between its two turns.
        ['one object twice, a key added in between', () => {
            const one = { a: 1 };
            return [one, { toJSON: () => { one.b = 2; return 0; } }, one];
        }],
        // A getter named like a question this walk asks is read once, by the
        // serialiser, as any other field.
        ['a getter named then', () => {
            let reads = 0;
            return Object.defineProperty({}, 'then', { enumerable: true, get: () => ++reads });
        }],
        ['a getter named ob_type', () => {
            let reads = 0;
            return Object.defineProperty({}, 'ob_type', { enumerable: true, get: () => ++reads });
        }]
    ])('%s is written as JSON.stringify writes it', ([, make]) => {
        expect(tojson(make())).toBe(JSON.stringify(make()));
        expect(tojson({ held: make() })).toBe(JSON.stringify({ held: make() }));
    });

    // And where the serialiser's conversion raises, so does this one: a Number
    // with no prototype has nothing `ToNumber` can call.
    test('a Number with nothing to convert it by raises, as the serialiser does', () => {
        const bare = () => Object.setPrototypeOf(new Number(1), null);

        expect(() => JSON.stringify(bare())).toThrow(TypeError);
        expect(() => tojson(bare())).toThrow(TypeError);
    });

    // The slot, not the look of it: a property called `rawJSON` is data, and a
    // Number object holding NaN is the NaN every other number is refused for.
    test('a property named rawJSON is data, and a boxed NaN is a NaN', () => {
        expect(tojson({ rawJSON: '1' })).toBe('{"rawJSON":"1"}');
        expect(() => tojson(new Number(NaN))).toThrow(/NaN has no JSON/);
    });

    // The rule above was stated for a class and enforced for a class alone,
    // while the neighbouring unserialisable shape — a call — had no arm at all.
    // `JSON.stringify` has no notation for one, so it drops it, and the dropping
    // is a different wrong answer in each position: `undefined` for a value, a
    // key that **disappears** from an object, `null` for an item. The first is
    // the worst, since `tojson` is written in templates, where `undefined`
    // renders as nothing.
    //
    // One sentence for every cell: the shape and the position are both the
    // author's, and neither may decide whether they are told.
    describe.for([
        ['a function', 'function'],
        ['a lambda', 'lambda'],
        ['a bound method', 'method'],
        ['a callable instance', 'instance'],
        ['a callable list', 'list'],
        ['a callable tuple', 'tuple'],
        ['a callable dict', 'dict'],
        ['a function JavaScript built', 'javascript']
    ])('%s', ([, shape]) => {
        test.for([
            ['on its own', 'alone'],
            ['inside a list', 'list'],
            ['inside a dict', 'dict'],
            ['inside a list a dict holds', 'deep']
        ])('is refused by name, %s', ([, position]) => {
            expect(says(shape, position)).toMatch(/svelthon — tojson\(\): .+ is callable/);
        });
    });

    // And the sentence names something the author wrote, which is this project's
    // central claim about messages and the half a refusal is worth.
    //
    // Three things may know what a callable is called and they are asked in the
    // order they are trustworthy: what Python recorded, then the name JavaScript
    // gave it. The second is not a fallback for the first — it is the only one
    // that answers for a function imported through `__js__`, where Python says
    // `<JavascriptFunction object>` for every import alike.
    test.for([
        ['the name its `def` gave it', 'function', /\bplain\(\)/],
        ['what Python calls an anonymous one', 'lambda', /<lambda>/],
        ['the receiver and the method', 'method', /Box\.save/],
        ['the class of the instance', 'instance', /Handler/],
        ['the name JavaScript gave it', 'javascript', /\bformatted\b/]
    ])('names it by %s', ([, shape, named]) => {
        expect(says(shape, 'alone')).toMatch(named);
        expect(says(shape, 'deep')).toMatch(named);
    });

    // A coroutine, which is the shape that did more than answer badly.
    //
    // The walk turned one into a promise before the JSON rule was consulted, and
    // `JSON.stringify` has nothing to write of a promise: `tojson(work())`
    // answered `{}` — valid JSON saying nothing — **and ran the author's body**
    // on the way. A serialiser is synchronous and starts nothing; the refusal
    // happens before anything is scheduled, which is what the counts on either
    // side of the call are there to prove.
    test.for([
        ['on its own', 'alone'],
        ['inside a mapping', 'nested']
    ])('is refused before it is started, %s', ([, where]) => {
        const [said, before, after] = coroutine_says(where);

        expect(said).toMatch(/svelthon — tojson\(\): .+ is a coroutine/);
        expect(said).toMatch(/await/i);
        expect(after).toBe(before);
    });

    // And a **JavaScript promise**, which is the coroutine's twin one language
    // over and got the answer the coroutine used to get: `{}`. A promise keeps
    // its result where nothing enumerable can reach it, so the serialiser wrote
    // valid JSON that says nothing about what was asked — and `{"task":{}}` one
    // level down, which is worse, because the shape around it looks right.
    //
    // The rule was stated for a coroutine and enforced for a coroutine alone,
    // exactly as the class rule was before the call joined it. Three rows: made
    // here, made in another JavaScript context, and a bare thenable, because the
    // question is *does `await` take this*, not *whose Promise built it*.
    test.for([
        ['a promise', () => Promise.resolve({ answer: 42 })],
        // The row that moved the refusal: a bare thenable is refused too, and
        // used to be told its `then` was callable — one value, two sentences,
        // decided by which constructor built it.
        ['a bare thenable', () => ({ then: (resolve) => resolve(1) })],
        // And a subclass, since `await` takes it and `instanceof` is not the
        // question. Another realm's Promise is the same fact and lives in
        // `tests/another-context.test.js`, where the realm family is held.
        ['a Promise subclass', () => new (class extends Promise {})(() => {})]
    ])('%s is refused, and named', ([, make]) => {
        expect(() => tojson(make())).toThrow(/svelthon — tojson\(\): .+ is a promise/);
        expect(() => tojson(make())).toThrow(/await/i);
        // One level down, where the shape around it made the empty object look
        // like an answer.
        expect(() => tojson({ task: make() })).toThrow(/is a promise/);
    });

    // A **native collection**, which is the same `{}` again with nothing
    // asynchronous about it. A Map and a Set keep their entries where no
    // enumerable property reaches, so the serialiser wrote valid JSON that had
    // lost them, and `{"map":{}}` one level down.
    //
    // The refusal is asked as a behaviour — a class of its own, no `toJSON`, no
    // enumerable key — rather than by naming Map and Set, so a Headers, a
    // Response and whatever the platform adds next are covered by the same line.
    // A Date and a URL carry `toJSON` and keep serialising, which is the control
    // the rule needs.
    // The rule is *a class of its own and no `toJSON`*, and it took three
    // spellings to get there. Naming Map and Set would have drifted. Asking
    // whether anything is enumerable was worse than drifting: it read "has a
    // property" as "its state is all in its properties", so `map.label = 'kept'`
    // walked straight past the guard and the entries were dropped in silence —
    // `{"label":"kept"}` for a Map that answers 42, which is the lie the guard
    // existed to stop.
    //
    // What is left is the language's own protocol. `toJSON` is how a class says
    // how it wants to be written; a class that does not say is not guessed at.
    // The cost is named in the last row: a plain data class is refused too,
    // because nothing here can tell its fields from a Map's label.
    test.for([
        ['a Map', () => new Map([['answer', 42]])],
        ['a Set', () => new Set([42])],
        ['a Map carrying a property', () => Object.assign(new Map([['answer', 42]]), { label: 'k' })],
        ['a Set carrying a property', () => Object.assign(new Set([42]), { label: 'k' })],
        ['an Error, whose message is not enumerable', () => Object.assign(new Error('gone'), { code: 'E' })],
        ['a Headers', () => new Headers({ a: 'b' })]
    ])('%s is refused rather than half-written', ([, make]) => {
        expect(() => tojson(make())).toThrow(/has no JSON of its own/);
        expect(() => tojson({ held: make() })).toThrow(/has no JSON of its own/);
    });

    test('and it is named by its class, which is what an author recognises', () => {
        expect(() => tojson(new Map())).toThrow(/a Map has no JSON/);
        expect(() => tojson(new Set())).toThrow(/a Set has no JSON/);
    });

    // The two halves of the contract, and the second is the cost of the first.
    test('while anything carrying toJSON says how it is written', () => {
        expect(tojson(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
        expect(tojson(new URL('https://example.test/a'))).toBe('"https://example.test/a"');

        class Money {
            toJSON() {
                return { amount: 3 };
            }
        }

        expect(tojson(new Money())).toBe('{"amount":3}');

        // A literal carrying it too, whether the method is enumerable or not,
        // and nested, where `JSON.stringify` hands it its key.
        const literal = { toJSON: () => ({ answer: 42 }) };
        const hidden = Object.defineProperty({}, 'toJSON', { value: () => ({ answer: 42 }) });
        const keyed = { toJSON: (key) => `at ${key}` };

        expect(tojson(literal)).toBe('{"answer":42}');
        expect(tojson(hidden)).toBe('{"answer":42}');
        expect(tojson([keyed])).toBe('["at 0"]');

        // An array too, its own method or its class's.
        const values = Object.assign([1, 2], { toJSON: () => ({ answer: 42 }) });
        class Counted extends Array {
            toJSON() {
                return { count: this.length };
            }
        }

        expect(tojson(values)).toBe('{"answer":42}');
        expect(tojson(Counted.from([1, 2]))).toBe('{"count":2}');
    });

    // What a hook answers is held to the same refusals as what the author
    // passed, from a literal as from a class instance, at any depth.
    test.for([
        ['a Map', () => new Map([['answer', 42]]), /a Map has no JSON of its own/],
        ['a promise', () => Promise.resolve(1), /is a promise/],
        ['a function', () => () => 1, /is callable/],
        ['a symbol', () => Symbol('marker'), /is a symbol/]
    ])('%s a toJSON hands back is refused', ([, make, message]) => {
        class Holder {
            toJSON() {
                return { inner: make() };
            }
        }

        expect(() => tojson({ toJSON: () => ({ inner: make() }) })).toThrow(message);
        expect(() => tojson(new Holder())).toThrow(message);
    });

    // A `toJSON` that gives no function is no hook, and keeps a Map or a Set
    // from nothing: it is refused as one without it is, at the root and held.
    test.for([
        ['a Map whose getter gives undefined', () => Object.defineProperty(new Map([['held', 1]]), 'toJSON', { get: () => undefined }), /a Map has no JSON/],
        ['a Map whose getter gives a string', () => Object.defineProperty(new Map([['held', 1]]), 'toJSON', { get: () => 'no' }), /a Map has no JSON/],
        ['a Set whose getter gives undefined', () => Object.defineProperty(new Set([1]), 'toJSON', { get: () => undefined }), /a Set has no JSON/]
    ])('%s is refused', ([, make, message]) => {
        expect(() => tojson(make())).toThrow(message);
        expect(() => tojson({ held: make() })).toThrow(message);
    });

    test('and a class that does not is refused rather than guessed at', () => {
        class Point {
            constructor() {
                this.x = 1;
            }
        }

        // Its own fields would have been written before, and a Map's label was
        // written the same way: nothing here can tell the two apart, so the
        // author is asked rather than the guess being made for them.
        expect(() => tojson(new Point())).toThrow(/a Point has no JSON of its own/);
        expect(() => tojson(new Point())).toThrow(/toJSON\(\)/);
    });

    // And the **space**, rather than the cell an outside reading happened to
    // land on. Three passes closed a promise, then a Map, then a set, each time
    // as a new subject; the shapes left over were found in twenty lines by
    // asking *what does `tojson` answer for everything it can be handed*.
    //
    // Two wrong answers, and they alternate. A value with no enumerable property
    // is written `{}` — valid JSON that has lost what it held, and worse one
    // level down where the shape around it looks right. A value the walk reads
    // through the engine's fields is accused of being its own class:
    // `<class 'range'> is a class` about a range.
    //
    // The floor under the named arms is one question, not a list of type names:
    // a Python value that is not a mapping and keeps nothing of the author's has
    // no representation here, which is what CPython says too — *Object of type
    // range is not JSON serializable*.
    describe.for([
        ['a set', () => _b_.set.$factory(_b_.list.$factory([42])), /is a set/, /list\(\)/],
        ['a frozenset', () => shapes('frozenset'), /is a set/, /list\(\)/],
        ['bytes', () => shapes('bytes'), /is bytes/, /decode\(\)/],
        ['a bytearray', () => shapes('bytearray'), /is bytes/, /decode\(\)/],
        ['a memoryview', () => shapes('memoryview'), /is a memoryview/, null],
        ['a range', () => shapes('range'), /is a range/, null],
        ['a complex', () => shapes('complex'), /is a complex/, null],
        ['a symbol', () => Symbol('marker'), /is a symbol/, null],
        // Derived from a builtin, which is the row identity missed: the class is
        // not the entry in Brython's table, so it answered *not a builtin* and
        // came out as its attributes — `{}`, or `{"label":"kept"}` with one
        // field on it, the number gone. The MRO is the question, and this file
        // has now asked it wrongly four times.
        ['a complex subclass', () => shapes('complex subclass'), /is a Money/, null],
        ['one carrying a field', () => shapes('complex subclass with a field'), /is a Tagged/, null],
        ['an exception subclass', () => shapes('exception subclass'), /is a Failure/, null]
    ])('%s', ([, make, named, wayOut]) => {
        test('is refused under its own name', () => {
            expect(() => tojson(make())).toThrow(named);
            // Never the accusation: the class of a value is not the value.
            expect(() => tojson(make())).not.toThrow(/is a class/);
        });

        test('and under a key, where the empty object looked like an answer', () => {
            expect(() => tojson({ held: make() })).toThrow(named);
        });

        if (wayOut !== null) {
            test('and says the way out a Python author already knows', () => {
                expect(() => tojson(make())).toThrow(wayOut);
            });
        }
    });

    // The limit, pinned so it is a contract rather than a surprise.
    //
    // `ob_type` is Brython's marker and it is an ordinary key, so a JavaScript
    // object can carry one. Holding a *string* there was the forty-second
    // reading's defect and is fixed; holding a real Brython **class** cannot be
    // told from the genuine article, and that was measured twice before being
    // written down here. A float from `1 / 4`, from a literal and from a sum
    // carries one of the engine's own prototypes — but a float that has crossed
    // a boundary is a plain object exactly like the imitation, and asking the
    // prototype turned fifty tests red, then thirty-six.
    //
    // So the contract is: a value carrying a Brython class under `ob_type` *is*
    // that value here. Closing it would take provenance from the engine — a
    // mark on what Brython itself made — which is upstream's to give.
    test('a JavaScript object claiming a Brython class is taken at its word', () => {
        const float = globalThis.__BRYTHON__.builtins.float;

        // Its own `label` is lost, because what it says it is has no room for
        // one. The row exists so the next reader meets the limit here and not in
        // a page.
        expect(tojson({ ob_type: float, value: 42, label: 'kept' })).toBe('42');

        // And the repair that *is* possible stands: a field of the same name
        // holding data is data.
        expect(tojson({ ob_type: 'business', value: 42, label: 'kept' })).toBe(
            '{"ob_type":"business","value":42,"label":"kept"}'
        );
    });

    // The controls the space needs, or every row above would pass by refusing
    // everything. These are the Python values that *do* have JSON.
    test.for([
        ['a dict', 'dict', '{"a":1}'],
        ['a list', 'list', '[1,2]'],
        ['a tuple', 'tuple', '[1,2]'],
        ['a string', 'text', '"hi"'],
        ['an instance, which is its fields', 'instance', '{"n":1}']
    ])('%s is written', ([, name, written]) => {
        expect(tojson(shapes(name))).toBe(written);
    });

    // A callable instance carries fields and they are not what it is: the export
    // hands it to JavaScript as its call. An instance that is *not* callable
    // stays what it has always been here, its fields, which is Svelthon's own
    // answer rather than CPython's.
    test('while an ordinary instance is still its fields', () => {
        expect(keeps_an_instance()).toBe('{"n":1}');
    });

    test.for([
        ['on its own', 'alone', '{"n":1}'],
        ['inside a list', 'list', '[{"n":1}]'],
        ['inside a dict', 'dict', '{"on_save":{"n":1}}'],
        ['inside a list a dict holds', 'deep', '{"handlers":[{"n":1}]}']
    ])('and data in the same position is written, %s', ([, position, written]) => {
        expect(control(position)).toBe(written);
    });
});

describe('from_json', () => {
    test('parses into something Python can read', () => {
        const parsed = from_json('{"a": [1, 2]}');

        expect(__pybridge.str(parsed)).toBe("{'a': [1, 2]}");
    });

    test('bad JSON raises rather than returning nothing', () => {
        expect(() => from_json('{')).toThrow();
    });

    // The way back, and the same crossing: JSON's `null` is Python's `None` at
    // every depth, and `is None` has to answer true for it rather than `repr`
    // printing `<Javascript null>`.
    test('null is None, at the top and inside', () => {
        expect(from_json('null')).toBe(NONE);
        expect(__pybridge.str(from_json('{"a": null}'))).toBe("{'a': None}");
        expect(__pybridge.str(from_json('[null, [null]]'))).toBe('[None, [None]]');
    });

    // An integer past 2^53 is not a double, and a reviver is too late to say so:
    // `JSON.parse` has already rounded the literal by the time one runs. The
    // digits survive only if whoever reads them reads the source text, which is
    // what going through `javascript.JSON` buys.
    test('an integer past 2^53 keeps its digits', () => {
        const digits = '12345678901234567890123';

        expect(__pybridge.str(from_json(`{"a": ${digits}}`))).toBe(`{'a': ${digits}}`);
        expect(from_json('9007199254740993')).toBe(9007199254740993n);

        // And nothing smaller changes shape: still a JavaScript number, and a
        // fraction is still a float rather than an int.
        expect(from_json('1')).toBe(1);
        expect(__pybridge.str(from_json('0.5'))).toBe('0.5');
    });
});

describe('batch', () => {
    // Read back the way Python would read it. Comparing the objects directly
    // would compare Brython lists against JavaScript arrays, which look alike
    // and are not.
    const rows = (result) => __pybridge.str(result);

    test('groups into rows, the last one short', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3, 4, 5]), 2))).toBe('[[1, 2], [3, 4], [5]]');
    });

    test('fill pads the last row, which is what aligns a table', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3]), 2, 0))).toBe('[[1, 2], [3, 0]]');
    });

    // The rule the whole set follows: None means *no* padding. It is an object,
    // so `!== undefined` alone would let it through and render it as a cell.
    test('None as the fill means no padding at all', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3]), 2, NONE))).toBe('[[1, 2], [3]]');
    });

    test.for([[0], [-1], [1.5], ['2'], [NONE]])('a size of %s is refused', ([size]) => {
        expect(() => batch(__pybridge.list([1]), size)).toThrow(
            /size must be an integer of at least one/
        );
    });

    test('an empty input gives no rows rather than one empty row', () => {
        expect(rows(batch(__pybridge.list([]), 3))).toBe('[]');
    });
});

describe('date', () => {
    // A fixed instant, so the assertions do not move with the clock. Noon UTC,
    // to keep the calendar day the same either side of the date line.
    const AT = '2026-09-10T12:00:00Z';

    test('reads the four shapes a component actually receives', () => {
        const expected = date(AT, 'medium', undefined, 'en-GB');

        expect(date(new Date(AT), 'medium', undefined, 'en-GB')).toBe(expected);
        expect(date(Date.parse(AT), 'medium', undefined, 'en-GB')).toBe(expected);
        expect(date('2026-09-10', 'medium', undefined, 'en-GB')).toBe(expected);
    });

    // **A date with no time is a calendar day, not an instant.** The
    // specification reads `"2026-09-10"` as midnight *UTC* and `Intl` renders
    // that instant in the reader's zone, so every reader west of Greenwich was
    // shown the day before: `date("2026-08-24")` answered 23 August in Los
    // Angeles, and nothing said so. Python answers it without ambiguity —
    // `datetime.date` carries no zone and Django's `|date`, which is this
    // helper's word, renders that day wherever it is read.
    //
    // There is no other shape to say *a day* with, either: the standard library
    // was removed, so a component has a string or a number and nothing else.
    //
    // The zone is moved through `process.env.TZ`, which `Intl` reads when a
    // formatter is constructed, and the **instant beside it is the control**:
    // without a row that does move, this test would pass on a host that ignores
    // the variable and prove nothing.
    describe.for([
        ['Europe/Paris'],
        ['UTC'],
        ['America/Los_Angeles'],
        ['Pacific/Auckland'],
        ['Pacific/Kiritimati']
    ])('read from %s', ([zone]) => {
        const inZone = (run) => {
            const before = process.env.TZ;
            process.env.TZ = zone;
            try {
                return run();
            } finally {
                process.env.TZ = before;
            }
        };

        test('a date with no time is the day it says', () => {
            expect(inZone(() => date('2026-09-10', 'medium', undefined, 'en-GB'))).toBe(
                '10 Sept 2026'
            );
        });

        test('and an instant is still read where the reader is', () => {
            const east = zone === 'Pacific/Auckland' || zone === 'Pacific/Kiritimati';

            expect(inZone(() => date('2026-09-10T12:00:00Z', 'medium', undefined, 'en-GB'))).toBe(
                east ? '11 Sept 2026' : '10 Sept 2026'
            );
        });
    });

    test('answers in the language it is given, which is the point of the locale', () => {
        expect(date(AT, 'long', undefined, 'fr-FR')).toMatch(/septembre/);
        expect(date(AT, 'long', undefined, 'en-GB')).toMatch(/September/);
    });

    test('with neither style it falls back to a medium date and no time', () => {
        expect(date(AT, undefined, undefined, 'en-GB')).toBe(date(AT, 'medium', undefined, 'en-GB'));
        expect(date(AT, NONE, NONE, 'en-GB')).toBe(date(AT, 'medium', undefined, 'en-GB'));
    });

    test('a time style alone gives a time alone', () => {
        const only = date(AT, undefined, 'short', 'en-GB');

        expect(only).toMatch(/\d/);
        expect(only).not.toMatch(/September|Sept/);
    });

    // Not a silent Invalid Date in the page: a value that is not a date is a
    // mistake, and the message names what it was given.
    test.for([['not a date'], [''], [NONE]])('%s is refused, and named', ([value]) => {
        expect(() => date(value)).toThrow(/date\(\): .* is not a date/);
    });

    // `JSON.stringify(undefined)` is `undefined`, not a string, so the message
    // would have read "date(): undefined is not a date" only by accident.
    test('and so is nothing at all', () => {
        expect(() => date(undefined)).toThrow(/date\(\): undefined is not a date/);
    });

    // A Python int above 2^53 is a BigInt, and `new Date` refuses one before the
    // Invalid Date guard can run: the author read `Cannot convert a BigInt value
    // to a number`, out of a template filter, on a line they never wrote.
    test('a big integer is refused by our sentence, not by a JavaScript accident', () => {
        expect(() => date(2n ** 70n)).toThrow(/date\(\): 1180591620717411303424 is not a date/);
        expect(() => fromnow(2n ** 70n)).toThrow(/fromnow\(\): 1180591620717411303424 is not/);
    });

    // `new Date` coerces through a value's *string* form, so a one-item list of a
    // year answered 1 January of it, a two-item list answered 2 January 2001, and
    // a boolean took the number route and answered the epoch. All three without a
    // word, which is the failure this set exists to avoid.
    test.for([
        ['a list of one', [2026]],
        ['a list of two', [1, 2]],
        ['a boolean', true]
    ])('%s is refused rather than coerced into a date', ([, value]) => {
        expect(() => date(value)).toThrow(/date\(\): .* is not a date/);
        expect(() => fromnow(value)).toThrow(/fromnow\(\): .* is not a date/);
    });

    // And the shape that must keep crossing: `from_json` gives a Brython float
    // for every JSON number with a decimal point, and a float is an object here,
    // so naming the shapes rather than coercing had to let this one through.
    test('a Python float still reads as the instant it holds', () => {
        const at = Date.parse('2026-09-10T12:00:00Z');
        const float = globalThis.__BRYTHON__.builtins.float.$factory(at);

        expect(date(float, 'medium', undefined, 'en-GB')).toBe(
            date(at, 'medium', undefined, 'en-GB')
        );
    });

    // Without a locale, `Intl` uses the platform's, which is the right default
    // and the wrong one under server rendering: see the note on the helper.
    test('with no locale it still formats, in the platform’s own', () => {
        expect(date(AT, 'medium')).toMatch(/\d/);
    });
});

describe('fromnow', () => {
    const at = (seconds) => new Date(Date.now() + seconds * 1000);

    // Every unit, both directions. The direction lives in the value, which is
    // why the name says neither "since" nor "until".
    test.for([
        [-90000000, /year/],
        [-3000000, /month/],
        [-700000, /week/],
        [-90000, /day/],
        [-4000, /hour/],
        [-90, /minute/],
        [-5, /second/]
    ])('a gap of %s seconds reads in its own unit', ([seconds, unit]) => {
        expect(fromnow(at(seconds), 'en-GB')).toMatch(unit);
    });

    // Three days rather than one: at a single unit `numeric: 'auto'` answers
    // "yesterday" and "tomorrow", which carry the direction in the word instead.
    test('the same gap forward and back differ only in direction', () => {
        expect(fromnow(at(-260000), 'en-GB')).toBe('3 days ago');
        expect(fromnow(at(260000), 'en-GB')).toBe('in 3 days');
    });

    test('and it speaks the language it is given', () => {
        expect(fromnow(at(-90000), 'fr-FR')).toMatch(/hier|jour/);
    });

    // `numeric: 'auto'` is what turns "1 day ago" into "yesterday", and it is
    // the reason a reader does not notice the helper at all.
    test('a single unit reads as a word rather than a number', () => {
        expect(fromnow(at(-86400), 'en-GB')).toBe('yesterday');
    });

    test.for([['not a date'], [NONE]])('%s is refused, and named', ([value]) => {
        expect(() => fromnow(value)).toThrow(/fromnow\(\): .* is not a date/);
    });

    test('with no locale it still formats, in the platform’s own', () => {
        expect(fromnow(at(-5))).toMatch(/\d|second|now/);
    });
});

describe('slugify', () => {
    test('a title becomes a URL segment', () => {
        expect(slugify('Making the GIL Optional!')).toBe('making-the-gil-optional');
    });

    test('accents are kept rather than folded away', () => {
        expect(slugify('Café Crème')).toBe('café-crème');
    });

    // The same character written two ways must give one slug, or two identical
    // titles produce two URLs.
    test('NFC first, so a composed and a decomposed é agree', () => {
        expect(slugify('café')).toBe(slugify('café'));
    });

    // A Devanagari vowel sign is a combining mark with no composed form, so
    // dropping marks would shred the word rather than fold it.
    test('marks are kept, which is what stops a script being shredded', () => {
        expect(slugify('हिन्दी भाषा')).toBe('हिन्दी-भाषा');
    });

    test('dashes are collapsed and trimmed at both ends', () => {
        expect(slugify('  --- a  //  b --- ')).toBe('a-b');
    });

    test('a non-string is read through Python first', () => {
        expect(slugify(42)).toBe('42');
    });
});

describe('striptags, off a browser', () => {
    // The whole server story in one branch: no fallback regex, because every
    // regex that ships with a template engine gets this wrong. A first render
    // shows less and then shows the text, rather than showing `caf&eacute;`.
    test('returns nothing rather than something wrong', () => {
        expect(typeof DOMParser).toBe('undefined');
        expect(striptags('<p>caf&eacute;</p>')).toBe('');
    });
});

describe('urlencode', () => {
    test('a string is escaped whole, the slash included', () => {
        expect(urlencode('a/b')).toBe('a%2Fb');
        expect(urlencode('café & co')).toBe('caf%C3%A9%20%26%20co');
    });

    test('a mapping becomes a query string', () => {
        expect(urlencode({ tag: 'a/b', page: 2 })).toBe('tag=a%2Fb&page=2');
    });

    // Jinja escapes the slash in a mapping and not in a string, because the two
    // forms reach different helpers. Escaping in both is the only reading that
    // holds, and this is what says so.
    test('and the two forms agree with each other, unlike Jinja', () => {
        expect(urlencode({ p: 'a/b' })).toBe('p=' + urlencode('a/b'));
    });

    // Read through Python instead, a Date gave
    // `%3CJavascript%20object%3A%20%5Bobject%20Date%5D%3E` in the query string.
    test('a Date is a value, and the sortable spelling of one', () => {
        expect(urlencode(new Date('2026-09-10T12:00:00Z'))).toBe('2026-09-10T12%3A00%3A00.000Z');
    });

    // An invalid Date is still a Date, and `toISOString` answers it with
    // `RangeError: Invalid time value` — V8's sentence, naming neither the
    // helper nor the value, out of a template filter. The two date helpers next
    // door already word this refusal, and one of the three was saying it in
    // another language.
    test('and an invalid one is refused the way date() refuses it', () => {
        expect(() => urlencode(new Date('nonsense'))).toThrow(/svelthon — urlencode\(\)/);
        expect(() => urlencode(new Date('nonsense'))).toThrow(/is not a date/);
        expect(() => urlencode(new Date('nonsense'))).not.toThrow(/Invalid time value/);
    });

    test('a number crosses as text', () => {
        expect(urlencode(42)).toBe('42');
    });

    // None is an object too, with `ob_type` and `__doc__` as own properties, so
    // it used to be walked as a mapping: `{urlencode(missing)}` wrote
    // `ob_type=%3Cclass+%27NoneType%27%3E&__doc__=` into the page.
    test('None is absence, not a mapping of its own internals', () => {
        expect(urlencode(NONE)).toBe('');
    });

    // And None was one instance of it, not the problem: almost every Python
    // value is an object here. A float is `{ob_type, value}`, so a price wrote
    // `ob_type=%3Cclass+%27float%27%3E&value=1.5` into the page, a list added
    // its class after its items, and a set wrote its whole internal store.
    test.for([
        ['a float', () => _b_.float.$factory(1.5)],
        ['a list', () => _b_.list.$factory([1, 2])],
        ['a tuple', () => _b_.tuple.$factory([1, 2])],
        ['a set', () => _b_.set.$factory(_b_.list.$factory([1]))]
    ])('%s never writes its own internals into a URL', ([, make]) => {
        const written = urlencode(make());

        expect(written).not.toMatch(/ob_type/);
        expect(written).not.toMatch(/%24store/);
    });

    // The question *is this a mapping I may walk?* was decided twice, and the
    // two decisions agreed on everything but one shape: `plainData` accepted a
    // null prototype and this file did not. So `to_js` and `tojson` rendered
    // `{"a":1,"b":2}` while `urlencode` fell through to its string branch and
    // wrote `<Javascript object: [object Object]>` into the page, percent-
    // encoded, with no error and no warning.
    //
    // Not a synthetic shape: `Object.groupBy` returns one, and so does a module
    // namespace object, which is what `importjs * as easing` hands over.
    //
    // The Date above is the other half of the same predicate and stays a value.
    test('an object with no prototype is a mapping, as it already was to to_js', () => {
        const bare = Object.create(null);

        bare.tag = 'a/b';
        bare.page = 2;

        expect(urlencode(bare)).toBe('tag=a%2Fb&page=2');
        expect(JSON.parse(tojson(bare))).toEqual({ tag: 'a/b', page: 2 });
    });

    // Jinja reads a float as a plain value, and so does this: `1.5`, not a
    // mapping of the object that holds it.
    test('a float is a value, as it is in Jinja', () => {
        expect(urlencode(_b_.float.$factory(1.5))).toBe('1.5');
    });

    // A Brython dict keeps its string keys as ordinary JavaScript properties and
    // everything else in a hash table under symbols, because a property name is
    // always a string and Python keeps `1` and `"1"` apart. Walking `Object.keys`
    // therefore read the fast half and dropped the rest, silently: a table
    // indexed by id encoded to nothing at all.
    //
    // The rule is CPython's, measured against `urllib.parse.urlencode`: the key
    // is whatever `str()` makes of it, and two keys that collide once written
    // both stay, as a query string allows.
    describe('a key that is not a string', () => {
        const dict = (entries) => {
            const $B = globalThis.__BRYTHON__;
            const out = _b_.dict.$factory();

            for (const [key, value] of entries) $B.$setitem(out, key, value);
            return out;
        };

        test('an integer key is kept, as str() writes it', () => {
            expect(urlencode(dict([[1, 'one'], ['s', 'text']]))).toBe('1=one&s=text');
        });

        test('and the two spellings of one number are two keys', () => {
            expect(urlencode(dict([[1, 'a'], ['1', 'b']]))).toBe('1=a&1=b');
        });

        test('a tuple key is written rather than dropped', () => {
            expect(urlencode(dict([[_b_.tuple.$factory([1, 2]), 'pair']]))).toBe(
                '%281%2C+2%29=pair'
            );
        });

        test('a float key keeps the spelling Python gives it', () => {
            expect(urlencode(dict([[_b_.float.$factory(1.5), 'f']]))).toBe('1.5=f');
        });
    });
});
