// Drive a headless Chromium over the DevTools protocol: load a page, run one
// snippet, print what it returns. Kept in the repository rather than /tmp, which
// gets swept and takes the driver with it.
//
//   chromium --headless --remote-debugging-port=9333 about:blank &
//   node scripts/drive.mjs <url> '<javascript>' [waitMs]
const [url, snippet, waitMs = '5000'] = process.argv.slice(2);

const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((one) => one.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);

let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
        const at = ++id;
        pending.set(at, { resolve, reject });
        socket.send(JSON.stringify({ id: at, method, params }));
    });

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const one = pending.get(message.id);
    if (!one) return;
    pending.delete(message.id);
    message.error ? one.reject(new Error(JSON.stringify(message.error))) : one.resolve(message.result);
});

await new Promise((resolve) => socket.addEventListener('open', resolve));
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, Number(waitMs)));

const result = await send('Runtime.evaluate', {
    expression: snippet,
    awaitPromise: true,
    returnByValue: true
});

console.log(JSON.stringify(result.result.value ?? result, null, 2));
socket.close();
process.exit(0);
