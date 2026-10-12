import { mount } from 'svelte';
import DomProbe from './DomProbe.svelte';
import { required } from './realm_probe.py';

// A URL and a Request of an iframe's own context, which carry that context's
// getters: what only a real browser has, and what the probe reports on.
const other = document.body.appendChild(document.createElement('iframe')).contentWindow;

try {
    globalThis.__realmProbe = required({
        url: new other.URL('https://example.test/peps'),
        request: new other.Request('https://example.test/peps'),
        params: { slug: 'peps' },
        fetch: globalThis.fetch
    });
} catch (error) {
    globalThis.__realmProbe = `ERR ${error.message}`;
}

mount(DomProbe, { target: document.getElementById('app') });
