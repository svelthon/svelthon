// @vitest-environment node
//
// The server half of a Python parent's snippet rendered by a Python child. A
// server hands a snippet values rather than reads, crossed before the call, so
// the snippet takes back the ones it was handed as it announces itself, by
// position; a JavaScript parent's snippet is still handed JavaScript's.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SnippetPythonParent from './fixtures/SnippetPythonParent.svelte';
import SnippetPythonChildHost from './fixtures/SnippetPythonChildHost.svelte';

test.for(['bare', 'alias', 'dict'])('a Python parent snippet rendered %s on a server keeps its values', (kind) => {
    expect(render(SnippetPythonParent, { props: { kind } }).body).toContain('float:1.0|Price|Label');
    expect(render(SnippetPythonChildHost, { props: { kind } }).body).toContain('number:1|number|string');
});
