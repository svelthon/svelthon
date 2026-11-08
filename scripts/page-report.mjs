// What a page reports in its `<pre id="…">`, read over the DevTools protocol
// from a Chromium started with --remote-debugging-port, in real time.
//
// `browser-check.sh` reads its other pages with `--dump-dom` and a virtual time
// budget, under which the browser renders no frame of its own: a page that
// waits on what the browser does between frames, a `scroll` event, waited for
// nothing, and every listener read the position it started at. Here the page
// runs as a page does, and its report is read once it is written. See
// `scripts/console-check.mjs` for the protocol itself.
//
//   chromium --headless --remote-debugging-port=9334 about:blank &
//   node scripts/page-report.mjs <url> <id>
const PORT = process.env.CDP_PORT || '9334';
const [url, id] = process.argv.slice(2);

// A page whose thread never yields, or whose renderer died, answers nothing,
// and the command sent to it waits for ever: past the budget of the loop below,
// the page said nothing, and the check asks again or fails.
setTimeout(() => {
    console.error(`page-report: ${url} answered nothing in 40 s`);
    process.exit(1);
}, 40_000).unref();

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((one) => one.type === 'page');

if (!page) {
    console.error('page-report: no page target; is Chromium running with --remote-debugging-port?');
    process.exit(2);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let next = 0;

const send = (method, params = {}) =>
    new Promise((resolve) => {
        const at = ++next;

        pending.set(at, resolve);
        socket.send(JSON.stringify({ id: at, method, params }));
    });

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
});

await new Promise((resolve) => socket.addEventListener('open', resolve));
await send('Page.enable');
await send('Page.navigate', { url });

let text = '';

for (let attempt = 0; attempt < 120 && text === ''; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const result = await send('Runtime.evaluate', {
        expression: `document.getElementById(${JSON.stringify(id)})?.textContent ?? ''`
    });

    text = result?.result?.value ?? '';
}

console.log(text);
socket.close();
