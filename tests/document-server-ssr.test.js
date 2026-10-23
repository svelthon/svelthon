// @vitest-environment node
//
// **A server that lays down a DOM still renders as a server.** A library that
// wants one, or a test run under jsdom, puts a `document` and a `window` on the
// global, and the bridge took the render for a browser's: the group's
// selection was missing from the HTML, and a snippet was handed a read of its
// argument, a function, where a server hands the value. The witness is the
// same render with no DOM, and Svelte's own group.
import { test, expect, afterAll } from 'vitest';
import { render } from 'svelte/server';
import { JSDOM } from 'jsdom';
import DocumentGroup from './fixtures/DocumentGroup.svelte';
import DocumentGroupNative from './fixtures/DocumentGroupNative.svelte';
import DocumentSnippetParent from './fixtures/DocumentSnippetParent.svelte';
import DocumentSnippetJSParent from './fixtures/DocumentSnippetJSParent.svelte';

const dom = new JSDOM('');
afterAll(() => dom.window.close());

const rendered = (Component, withDom) => {
    if (withDom) Object.assign(globalThis, { document: dom.window.document, window: dom.window });

    try {
        return render(Component).body.replace(/<!--[^>]*-->/g, '');
    } finally {
        delete globalThis.document;
        delete globalThis.window;
    }
};

const checked = (html) => [...new JSDOM(html).window.document.querySelectorAll('input')].map((one) => one.hasAttribute('checked'));

test.for([[false], [true]])('a group writes its selection on a server, a DOM on the global or not (%s)', ([withDom]) => {
    expect(checked(rendered(DocumentGroupNative, withDom))).toEqual([true, false, false, true]);
    expect(checked(rendered(DocumentGroup, withDom))).toEqual([true, false, false, true]);
});

test.for([[false], [true]])('a snippet is handed its value on a server, a DOM on the global or not (%s)', ([withDom]) => {
    expect(rendered(DocumentSnippetParent, withDom)).toContain('<output>float:1.0</output>');
    expect(rendered(DocumentSnippetJSParent, withDom)).toContain('<output>number:1</output>');
});
