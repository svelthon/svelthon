// What the browser says, collected over the DevTools protocol.
//
// `scripts/browser-check.sh` asserts one string out of the DOM of each page and
// used to send the browser's own output to /dev/null, so a Brython traceback, an
// unhandled rejection or a CSP violation was invisible as long as that string
// was still there.
//
// The obvious instrument is `--enable-logging=stderr --v=1` and a grep for
// `ERROR:CONSOLE`, and it answers "nothing said" whether or not anything was
// said — but not for the reason the first version of this comment gave.
//
// The channel **does** carry a page's messages, in thirteen thousand lines of
// Chromium's own verbosity. What is useless is the severity prefix: a
// `console.error` and an uncaught exception both arrive as `INFO:CONSOLE`, and
// `ERROR:CONSOLE` never appears at all.
//
//   INFO:CONSOLE:1] "INJURY"
//   INFO:CONSOLE:1] "Uncaught Error: BOOM"
//
// The first comment here said the channel carried nothing, "measured four ways".
// It was measured four ways on a `file://` page whose script never ran — the
// control that was missing is the one that says the page spoke at all. Over
// http the same page speaks every time. A measurement that cannot contradict
// you is the thing this project keeps a rule about, and this is it.
//
// The protocol is used anyway, and it is the better instrument for its own
// reason: it reports the level, so `console.warn` can be let through while an
// error is not, and it hands over the position.
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
