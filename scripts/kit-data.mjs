// What a Python page reads of what its server handed it, in a real browser and
// on the server, case by case and door by door: the page the server rendered
// and hydrated, a client navigation to it, an action's answer, a streamed
// coroutine's result, a page written in JavaScript, and a `load()` written in
// JavaScript, one value, several, or what it keeps between requests. Svelte
// warns of no text a hydration changes, so each text is compared with the
// server's own.
//
//   node scripts/kit-data.mjs <origin> [doors]      CDP_PORT, a headless Chromium
const [origin, doorList = 'ssr,nav,action,stream,js,jsload,jsgroup'] = process.argv.slice(2);
const doors = doorList.split(',');
const cdp = process.env.CDP_PORT ?? '9334';

const decoded = (text) =>
    text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
const picked = (html, key) => {
    const found = html.match(new RegExp(`<p data-k="${key}">([\\s\\S]*?)</p>`));

    return found ? decoded(found[1]) : null;
};

const targets = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json();
const socket = new WebSocket(targets.find((one) => one.type === 'page').webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
let said = [];

const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
        const at = ++id;

        pending.set(at, { resolve, reject });
        socket.send(JSON.stringify({ id: at, method, params }));
    });

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        said.push(message.params.args.map((one) => one.value ?? one.description ?? '').join(' ').slice(0, 200));
    } else if (message.method === 'Runtime.exceptionThrown') {
        said.push((message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text).slice(0, 200));
    }

    const one = pending.get(message.id);

    if (!one) return;
    pending.delete(message.id);
    message.error ? one.reject(new Error(JSON.stringify(message.error))) : one.resolve(message.result);
});

await new Promise((resolve) => socket.addEventListener('open', resolve));
await send('Page.enable');
await send('Runtime.enable');

const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

// Until the page says so, a time limit only for a page that never does.
const until = async (expression, limit = 8000) => {
    const start = Date.now();

    while (Date.now() - start < limit) {
        if (await evaluate(expression).catch(() => false)) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return false;
};

const visit = async (path) => {
    await send('Page.navigate', { url: `${origin}${path}` });
    return until(`document.readyState === 'complete' && document.body.dataset.navigated === '1'`);
};

const text = (key) => evaluate(`document.querySelector('[data-k="${key}"]')?.textContent ?? null`);
const server = async (path, init) => decoded(await (await fetch(`${origin}${path}`, init)).text());

const names = [...(await server('/data')).matchAll(/<a href="\/data\/([^"]+)" data-k=/g)].map((one) => one[1]);
let failed = false;

const compare = (door, name, key, expected, seen) => {
    const words = [...new Set(said)];
    const same = expected !== null && expected === seen && words.length === 0;

    console.log(`${same ? '✓' : '✗'} kit data ${door} ${name} ${key} — ${seen}`);
    if (!same) {
        failed = true;
        if (expected !== seen) console.log(`    server: ${expected}`);
        for (const word of words) console.log(`    said: ${word}`);
    }
};

for (const name of names) {
    const html = await server(`/data/${name}`);

    if (doors.includes('ssr')) {
        said = [];
        await visit(`/data/${name}`);
        compare('ssr', name, 'value', picked(html, 'value'), await text('value'));
        compare('ssr', name, 'top', picked(html, 'top'), await text('top'));
    }

    if (doors.includes('nav')) {
        await visit('/data');
        said = [];
        await evaluate(`document.querySelector('a[data-k="${name}"]').click()`);
        await until(`document.body.dataset.navigated === '2'`);
        compare('nav', name, 'value', picked(html, 'value'), await text('value'));
        compare('nav', name, 'top', picked(html, 'top'), await text('top'));
    }

    if (doors.includes('action')) {
        const answered = await server(`/data/${name}`, {
            method: 'POST',
            headers: { origin, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' },
            body: ''
        });

        await visit(`/data/${name}`);
        said = [];
        await evaluate(`document.querySelector('[data-k="go"]').click()`);
        await until(`document.querySelector('[data-k="form"]')?.textContent !== 'no form' && document.body.dataset.navigated === '1'`);
        compare('action', name, 'form', picked(answered, 'form'), await text('form'));
    }

    if (doors.includes('stream')) {
        said = [];
        await visit(`/data/stream/${name}`);
        await until(`document.querySelector('[data-k="value"]') !== null`);
        compare('stream', name, 'value', picked(html, 'value'), await text('value'));
    }

    if (doors.includes('js')) {
        const page = await server(`/data/js/${name}`);

        said = [];
        await visit(`/data/js/${name}`);
        compare('js', name, 'value', picked(page, 'value'), await text('value'));
    }

    // A `load()` written in JavaScript, which calls Python, read by a Python page.
    if (doors.includes('jsload')) {
        const page = await server(`/data/jsload/${name}`);

        said = [];
        await visit(`/data/jsload/${name}`);
        compare('jsload', name, 'value', picked(page, 'value'), await text('value'));
    }

    // Two of its values in an array and one two levels down.
    if (doors.includes('jsgroup')) {
        const page = await server(`/data/jsgroup/${name}`);

        said = [];
        await visit(`/data/jsgroup/${name}`);
        compare('jsgroup', name, 'items', picked(page, 'items'), await text('items'));
        compare('jsgroup', name, 'deep', picked(page, 'deep'), await text('deep'));
    }
}

// What a JavaScript `load()` keeps between requests, empty at first, then
// holding Python values.
if (doors.includes('jsgroup')) {
    for (const path of ['/data/store', '/data/store?fill']) {
        const page = await server(path);

        said = [];
        await visit(path);
        compare('jsgroup', path.slice('/data/'.length), 'value', picked(page, 'value'), await text('value'));
    }
}

// Python values in JavaScript containers, one the application's transport
// writes and one with no prototype, which a JavaScript page reads as they
// were, after hydration and after a navigation.
if (doors.includes('jsgroup')) {
    const page = await server('/data/ledger');

    said = [];
    await visit('/data/ledger');
    compare('jsgroup', 'ledger', 'value', picked(page, 'value'), await text('value'));
    await visit('/data');
    said = [];
    await evaluate(`document.querySelector('a[data-n="ledger"]').click()`);
    await until(`document.body.dataset.navigated === '2'`);
    compare('nav', 'ledger', 'value', picked(page, 'value'), await text('value'));
    compare('jsgroup', 'ledger', 'server', 'ledger:2, no prototype, one list', picked(page, 'value'));
}

// A JavaScript `load()` its module binds again at its first call: served to
// the next requests of the same process.
if (doors.includes('js')) {
    const turns = [];

    for (let at = 0; at < 3; at++) turns.push(picked(await server('/data/rebound'), 'turn'));
    said = [];
    compare('js', 'rebound', 'turn', 'first second second', turns.join(' '));
}

// A layout's data a page's `load()` hands on whole, SvelteKit's merge of it.
if (doors.includes('ssr')) {
    const html = await server('/data/handed');

    said = [];
    await visit('/data/handed');
    compare('ssr', 'handed', 'value', picked(html, 'value'), await text('value'));
    compare('ssr', 'handed', 'top', picked(html, 'top'), await text('top'));
}

// An action's answer holding an iterator the page walks as it renders, which
// SvelteKit writes out after: the browser reads it as it was returned.
if (doors.includes('action')) {
    const answered = await server('/data/walked', {
        method: 'POST',
        headers: { origin, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' },
        body: ''
    });

    await visit('/data/walked');
    said = [];
    await evaluate(`document.querySelector('[data-k="go"]').click()`);
    await until(`document.querySelector('[data-k="form"]')?.textContent !== 'no form' && document.body.dataset.navigated === '1'`);
    compare('action', 'walked', 'form', picked(answered, 'form'), await text('form'));
}

// Remote answers a JavaScript `load()` hands its page, one of them changed by
// the load: the browser rebuilt it as the remote function answered it, the
// change lost, after hydration and after a navigation.
if (doors.includes('ssr')) {
    const page = await server('/relayed');

    said = [];
    await visit('/relayed');
    for (const key of ['relayed', 'made', 'changed', 'shelf']) compare('ssr', 'relayed', key, picked(page, key), await text(key));
    await visit('/data');
    said = [];
    await evaluate(`const link = document.createElement('a'); link.href = '/relayed'; document.body.append(link); link.click()`);
    await until(`document.body.dataset.navigated === '2'`);
    for (const key of ['relayed', 'made', 'changed', 'shelf']) compare('nav', 'relayed', key, picked(page, key), await text(key));

    // And a pair the load takes apart, or makes of one, as its page's one
    // Python value: read after a navigation with the sharing it had before.
    for (const [mode, expected] of [['split', 'apart|apart'], ['merge', 'shared|shared']]) {
        const paired = await server(`/paired/${mode}`);

        said = [];
        await visit(`/paired/${mode}`);
        compare('ssr', `paired-${mode}`, 'paired', expected, await text('paired'));
        await visit('/data');
        said = [];
        await evaluate(`const link = document.createElement('a'); link.href = '/paired/${mode}'; document.body.append(link); link.click()`);
        await until(`document.body.dataset.navigated === '2'`);
        compare('nav', `paired-${mode}`, 'paired', picked(paired, 'paired'), await text('paired'));
    }
}

// What a remote function prerendered, which the server reads back from the
// site's address as it renders, and hands the page: an instance, rebuilt there
// under the build's signature, and in the browser by its class.
if (doors.includes('ssr')) {
    said = [];
    await visit('/remote');
    await until(`document.querySelector('[data-k="facts"]') !== null`);
    compare('ssr', 'remote', 'facts', "prerendered from Python, [0, 1, 4, 9], Point:Point(3) attrs=[('x', 3)]", await text('facts'));
}

socket.close();
process.exit(failed || names.length === 0 ? 1 : 0);
