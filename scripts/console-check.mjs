// What the browser says, collected over the DevTools protocol.
//
// `scripts/browser-check.sh` asserts one string out of the DOM of each page and
// used to send the browser's own output to /dev/null, so a Brython traceback, an
// unhandled rejection or a CSP violation was invisible as long as that string
// was still there.
//
// The obvious instrument does not work: `--enable-logging=stderr --v=1` writes
// fourteen thousand lines of Chromium's own verbosity and **not one** of them
// carries a page's `console.error` or an uncaught exception. Measured four ways,
// with `--headless=old` and three log levels. `ERROR:CONSOLE` never appears, so
// grepping for it answers "nothing said" whether or not anything was said.
//
// `Runtime.enable` is the channel that carries them: `consoleAPICalled` for what
// the page logs, `exceptionThrown` for what it throws. Same shape as
// `scripts/drive.mjs`, which is where this protocol was already in use.
//
//   chromium --headless --remote-debugging-port=9334 about:blank &
//   node scripts/console-check.mjs <url> [url...]
const PORT = process.env.CDP_PORT || '9334';
const urls = process.argv.slice(2);
const WAIT = Number(process.env.CONSOLE_WAIT || 8000);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((one) => one.type === 'page');

if (!page) {
    console.error('console-check: no page target; is Chromium running with --remote-debugging-port?');
    process.exit(2);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
const said = [];

let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
        const at = ++id;
        pending.set(at, { resolve, reject });
        socket.send(JSON.stringify({ id: at, method, params }));
    });

const text = (one) => one.value ?? one.description ?? one.unserializableValue ?? one.type;

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    // A page's own `console.error`, and anything it threw and nobody caught.
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        said.push(`console.error: ${message.params.args.map(text).join(' ')}`);
    }

    if (message.method === 'Runtime.exceptionThrown') {
        const one = message.params.exceptionDetails;

        said.push(`uncaught: ${one.exception?.description ?? one.text}`);
    }

    const waiting = pending.get(message.id);

    if (!waiting) return;
    pending.delete(message.id);
    message.error ? waiting.reject(new Error(JSON.stringify(message.error))) : waiting.resolve(message.result);
});

await new Promise((resolve) => socket.addEventListener('open', resolve));
await send('Page.enable');
await send('Runtime.enable');

for (const url of urls) {
    await send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, WAIT));
}

socket.close();

if (said.length === 0) {
    console.log(`✓ console — nothing said in ${urls.length} page${urls.length > 1 ? 's' : ''}`);
    process.exit(0);
}

console.log('✗ console — the browser reported:');
for (const one of said.slice(0, 20)) console.log(`  ${one}`);
process.exit(1);
