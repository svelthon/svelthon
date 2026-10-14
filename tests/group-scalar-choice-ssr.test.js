// @vitest-environment node
//
// The server half of `group-scalar-choice.test.js`: a choice the model holds
// is served checked, even when only itself is equal to it.
//
// Svelte's server and browser disagree on a NaN radio: the browser compares its
// value with `Object.is` and checks it, the server with `===` and serves it
// unchecked, for hydration to check. Svelthon serves what the browser shows.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GroupScalarChoice from './fixtures/GroupScalarChoice.svelte';
import GroupScalarChoiceNative from './fixtures/GroupScalarChoiceNative.svelte';

const KINDS = ['nan', 'price', 'count', 'label', 'float', 'int', 'str'];
const served = (Component, props) => /<input[^>]*\schecked/.test(render(Component, { props }).body);

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        ['checkbox', 'radio'].flatMap((control) => KINDS.map((kind) => [language, control, kind]))
    )
)('%s: a %s whose choice is %s, held by the model, is served checked', ([language, control, kind]) => {
    const Component = language === 'Python' ? GroupScalarChoice : GroupScalarChoiceNative;
    const svelteServer = language === 'Svelte' && control === 'radio' && kind === 'nan';

    expect(served(Component, { kind, control })).toBe(!svelteServer);
});
