// What a route module hands SvelteKit: the names SvelteKit reads off it,
// whatever binds them, and the `load` the module holds now, which SvelteKit
// reads off it at each request.
import { test, expect } from 'vitest';
import * as rebound from './fixtures/routes/rebound/+page.server.py';
import * as aliased from './fixtures/routes/aliased/+page.py';
import * as disabled from './fixtures/routes/disabled/+page.server.py';
import * as enabled from './fixtures/routes/enabled/+page.server.py';
import * as branched from './fixtures/routes/branched/+page.server.py';
import * as same from './fixtures/routes/same/+page.server.py';
import * as made from './fixtures/routes/made/+page.server.py';
import * as imported from './fixtures/routes/imported/+page.server.py';
import * as starredRoute from './fixtures/routes/starred/+page.server.py';
import * as lambdaLayout from './fixtures/routes/lambda/+layout.py';
import * as endpoint from './fixtures/routes/endpoint/+server.py';
import * as serverHooks from './fixtures/routes/hooks/hooks.server.py';
import * as clientHooks from './fixtures/routes/hooks/hooks.client.py';
import * as universalHooks from './fixtures/routes/hooks/hooks.py';
import * as jsBrought from './fixtures/routes/jsbrought/+page.server.py';
import * as jsLoaders from './fixtures/routes/jsbrought/loaders.js';

const phases = async (module, times) => {
    const out = [];

    for (let i = 0; i < times; i++) out.push((await module.load?.({}))?.phase);

    return out;
};

// A module that binds `load` again had the function it held at import called
// at every request, as no JavaScript module's `export let load` has.
test.for([
    ['a def that binds its name again', rebound, ['first', 'second', 'second']],
    ['an alias bound again', aliased, ['first', 'second', 'second']],
    ['a load bound to None', disabled, ['first', undefined, undefined]]
])("a route's load is the one its module holds at each call: %s", async ([, module, expected]) => {
    expect(await phases(module, 3)).toEqual(expected);
});

// And one that held none at import had none at every request, whatever an
// action bound it to after.
test.for([
    ['bound to None', enabled],
    ['bound in a branch not taken', branched]
])("a route's load an action binds is the one SvelteKit calls: %s", async ([, module]) => {
    const seen = [];

    for (const action of ['', 'enable', 'disable', 'enable']) {
        await module.actions[action]?.({});
        seen.push(module.load === undefined ? 'none' : (await module.load({})).phase);
    }

    expect(seen).toEqual(['none', 'active', 'none', 'active']);
    expect(Object.getPrototypeOf(await module.load({}))).toBe(Object.prototype);
});

// The same function bound again, or bound back, was another object to
// JavaScript, which a `WeakMap` keyed by it no longer found.
test("a route's load bound again to the same function is the same object", async () => {
    const saved = same.load;
    const seen = [];

    for (const step of ['_same', '_other', '_restore']) {
        same[step]();
        seen.push([same.load === saved, (await same.load({})).phase]);
    }

    expect(seen).toEqual([
        [true, 'first'],
        [false, 'second'],
        [true, 'first']
    ]);
});

// Bound by anything but a `def`, the page answered no data and no word was
// said.
test.for([
    ['a call', made, 'made'],
    ['an import', imported, 'imported'],
    ['a star import', starredRoute, 'starred'],
    ['a lambda', lambdaLayout, 'lambda']
])('a route module exports its load whatever binds it: %s', async ([, module, phase]) => {
    expect((await module.load({})).phase).toBe(phase);
});

test('and its options, and an endpoint its handlers', () => {
    expect(made.ssr).toBe(false);
    expect(starredRoute.ssr).toBe(false);
    expect(endpoint.GET({})).toBe('got');
});

// So does a module of hooks, each kind its own: `handle = sequence(a, b)` was
// no export, and the development server answered without the hook.
test('a hooks module exports the hooks SvelteKit reads off it, whatever binds them', () => {
    expect([
        serverHooks.handle({}),
        serverHooks.handleFetch({}),
        serverHooks.handleError({}),
        serverHooks.init(),
        clientHooks.handleError({}),
        clientHooks.init(),
        universalHooks.reroute({}),
        typeof universalHooks.transport
    ]).toEqual(['handle', 'handleFetch', 'handleError', 'init', 'handleError', 'init', 'reroute', 'object']);
});

// And so is one `__js__` brings, JavaScript's own: the page answered no data,
// a module of hooks had no `transport` (the SvelteKit check reads one). A
// server route's `load` is relayed as a JavaScript server module's.
test('a name SvelteKit reads that __js__ brings is exported, a server load relayed', async () => {
    expect([(await jsBrought.load({})).phase, jsBrought.prerender, jsBrought.load === jsLoaders.load]).toEqual(['from javascript', false, false]);
});
