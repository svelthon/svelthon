// A player's settings bound to members of one Python object, set together by a
// controller, in a browser: Chromium hands back each change by an event of its
// own, later, where jsdom fires it from the setter, so only a browser saw the
// first event's write hand the others' old values back to the player. Compared
// with Svelte's own component.
import { mount, flushSync } from 'svelte';
import MediaSharedSettings from '../tests/fixtures/MediaSharedSettings.svelte';
import MediaSharedSettingsNative from '../tests/fixtures/MediaSharedSettingsNative.svelte';

const report = document.getElementById('media');
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const read = async (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    for (const audio of target.querySelectorAll('audio')) {
        audio.volume = 0.125;
        audio.playbackRate = 1.125;
        audio.muted = true;
    }

    await settle();
    flushSync();
    await settle();

    const players = [...target.querySelectorAll('audio')].map((one) => `${one.dataset.k} ${one.volume} ${one.playbackRate} ${one.muted}`);

    return `${players.join(', ')} | ${target.querySelector('[data-k="model"]').textContent}`;
};

try {
    const python = await read(MediaSharedSettings);
    const svelte = await read(MediaSharedSettingsNative);

    report.textContent = python === svelte ? `media=OK ${python}` : `media=ERR python ${python} / svelte ${svelte}`;
} catch (error) {
    report.textContent = `media=ERR ${error.message}`;
}
