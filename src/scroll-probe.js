// The window's two scroll coordinates bound to members of one Python dict, in
// a browser, where a page really scrolls: the write of one axis set the other
// back to the value it held, so `scrollTo(130, 240)` ended at (130, 0), or at
// (0, 240) with Y bound first. Each component mounted alone, since one window
// is bound by all, and compared with Svelte's own.
import { mount, unmount, flushSync } from 'svelte';
import WindowScrollXY from '../tests/fixtures/WindowScrollXY.svelte';
import WindowScrollYX from '../tests/fixtures/WindowScrollYX.svelte';
import WindowScrollNative from '../tests/fixtures/WindowScrollNative.svelte';

const report = document.getElementById('scroll');
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

const read = async (name, Component) => {
    window.scrollTo(0, 0);
    await settle();

    const target = document.body.appendChild(document.createElement('div'));
    const component = mount(Component, { target });

    flushSync();
    await settle();
    window.scrollTo(130, 240);
    await settle();
    flushSync();
    await settle();

    const seen = `${name} ${window.scrollX} ${window.scrollY} (${target.querySelector('[data-k="model"]').textContent})`;

    unmount(component);
    target.remove();

    return seen;
};

try {
    const seen = [
        await read('xy', WindowScrollXY),
        await read('yx', WindowScrollYX),
        await read('native', WindowScrollNative)
    ];
    const native = seen[2].replace('native ', '');
    const same = seen.slice(0, 2).every((one) => one.replace(/^\w+ /, '') === native);

    report.textContent = `scroll=${same ? 'OK' : 'ERR'} ${seen.join(' | ')}`;
} catch (error) {
    report.textContent = `scroll=ERR ${error.message}`;
}
