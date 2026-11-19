// A warning Svelte makes of a Python component, placed on what the author wrote:
// the lines were kept, the columns were those of the emitted markup, where
// `{word.upper()}` written as a call pushed the `<img>` after it on its line.
// Placed as vite-plugin-svelte compiles, whose compile the plugin holds
// (`api.compileSvelte`), before the author's own filter, which still decides.
import { test, expect } from 'vitest';
import MagicString from 'magic-string';
import { preprocess, compile } from 'svelte/compiler';
import { python, svelthon } from '../src/lib/svelthon.js';

const line = '<p>{word.upper()} and {count + 1}</p><img src={pic}>';
const script = '<script lang="python">\nword = "a"\ncount = 1\npic = "p.png"\n</script>\n\n';
const source = `${script}${line}\n`;

const configured = (warningFilter, dynamicCompileOptions) => {
    const api = { options: { compilerOptions: { warningFilter }, dynamicCompileOptions } };

    svelthon().configResolved({ root: '/app', resolve: {}, plugins: [{ name: 'vite-plugin-svelte:config', api }] });
    api.compileSvelte = async (request, code, options) => ({
        compiled: compile(code, {
            ...options.compilerOptions,
            ...(await options.dynamicCompileOptions?.({ filename: request.filename, code, compileOptions: options.compilerOptions })),
            filename: request.filename
        })
    });

    return api;
};
const preprocessed = async (text, filename) => (await preprocess(text, [python()], { filename })).code;
const warned = async (api, code, filename) => (await api.compileSvelte({ filename }, code, api.options)).compiled.warnings.find((one) => one.code === 'a11y_missing_attribute');

test('a warning is placed at the column the author wrote, its frame drawn on what was written', async () => {
    const filename = '/app/src/Placed.svelte';
    const placed = await warned(configured(), await preprocessed(source, filename), filename);
    const at = source.indexOf('<img');

    expect([placed.start, placed.position[0]]).toEqual([{ line: 7, column: line.indexOf('<img'), character: at }, at]);
    expect(placed.frame).toContain(`7: ${line}`);
    expect(placed.frame).not.toContain('__expr');
});

// The declarations the pass writes after the markup, on its last line where the
// file ends without a newline, held every letter of the rest of the line: the
// `<img>` was placed after the `{`.
test('a warning on the last line of a file ending without a newline is placed where it was written', async () => {
    const filename = '/app/src/Last.svelte';
    const written = '<p>{count + 1} samples</p><img src={pic}>';
    const placed = await warned(configured(), await preprocessed(script + written, filename), filename);

    expect(placed.start.column).toBe(written.indexOf('<img'));
});

test('the author’s filter reads the warning placed, and still decides', async () => {
    const seen = [];
    const api = configured((warning) => (seen.push(warning.start.column), warning.code !== 'a11y_missing_attribute'));
    const filename = '/app/src/Placed.svelte';

    expect(await warned(api, await preprocessed(source, filename), filename)).toBeUndefined();
    expect(seen).toEqual([line.indexOf('<img')]);
});

// And a filter `dynamicCompileOptions` answers, which vite-plugin-svelte puts
// over the global one: it read the columns of the code emitted.
test('a filter dynamicCompileOptions answers reads the warning placed too', async () => {
    const seen = [];
    const warningFilter = (warning) => (seen.push(warning.start.column), true);
    const api = configured(undefined, () => ({ warningFilter }));
    const filename = '/app/src/Placed.svelte';

    await warned(api, await preprocessed(source, filename), filename);

    expect(seen).toEqual([line.indexOf('<img')]);
});

// Svelte names a file under its working directory by the relative path, where
// the preprocessor was handed the whole one: the warning was left where the
// emitted markup put it.
test('a file under the working directory is placed too', async () => {
    const filename = `${process.cwd()}/src/Placed.svelte`;
    const placed = await warned(configured(), await preprocessed(source, filename), filename);

    expect(placed.filename).toBe('src/Placed.svelte');
    expect(placed.start.column).toBe(line.indexOf('<img'));
});

// An interpolation written over several lines between quotes kept them, as one
// without quotes does: everything below it was reported lines too high.
test('an interpolation over several lines between quotes keeps its lines', async () => {
    const filename = '/app/src/Quoted.svelte';
    const text = `${script}<p title="Count {(\n    count + 1\n)}">Samples</p>\n<img src={pic}>\n`;
    const placed = await warned(configured(), await preprocessed(text, filename), filename);

    expect(placed.start).toEqual({ line: 10, column: 0, character: text.indexOf('<img') });
});

// A preprocessor after Svelthon's that adds lines moves the code Svelte warns
// of, which the map vite-plugin-svelte hands with it reads back: the warning
// was placed two lines below the end of the file, and the filter missed it.
test('a preprocessor after Svelthon’s that adds lines is read back by its map', async () => {
    const filename = '/app/src/Noted.svelte';
    const noted = {
        script({ content, attributes }) {
            if (attributes.module) return undefined;

            const edited = new MagicString(content).prepend('\n/* build note */\n');

            return { code: edited.toString(), map: edited.generateMap({ source: filename, hires: true }) };
        }
    };
    const { code, map } = await preprocess(source, [python(), noted], { filename });
    const api = configured();
    const { compiled } = await api.compileSvelte({ filename }, code, api.options, undefined, map);

    expect(compiled.warnings.find((one) => one.code === 'a11y_missing_attribute').start).toEqual({
        line: 7,
        column: line.indexOf('<img'),
        character: source.indexOf('<img')
    });
});

// A tag written inside a Python string, shown as text, is no tag: placed by
// aligning the markup emitted with what was written, the warning of the real
// `<img>` after it went to the one in the string, and a filter that set the
// example apart dropped it. Each piece `{ img }` is a real image.
let examples = 0;

test.for([
    [['<p>{label}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>{"<img"}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>{"<img src= "}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>{"<img src=x>"}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>', { img: '<img title={"<img src=x>"} src={picture}>' }, '</p>']],
    [['<p>{f"<img {label}>"}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>{label + " <img>"}', { img: '<img src={picture}>' }, '</p>']],
    [['<p>{label}', { img: '<img src={picture}>' }, { img: '<img src={picture}>' }, '</p>']],
    [['<p>{"<img src=x>"}', { img: '<img src={picture}>' }, { img: '<img src={picture}>' }, '</p>']],
    [['<p title="{label}">{label}', { img: '<img src={picture}>' }, '</p>']],
    [[{ img: '<img src={picture} title={f"<img {label}>"}>' }]],
    [['<span>{"<img src=x>"}</span>', { img: '<img src={picture}>' }]],
    [['<p>{"😀 <img src=x>"}', { img: '<img src={picture}>' }, '</p>']]
])('a warning after a tag written inside a Python string is placed on the real one: %j', async ([pieces]) => {
    const filename = `/app/src/Example${(examples += 1)}.svelte`;
    const markup = pieces.map((one) => one.img ?? one).join('');
    const images = [];

    pieces.reduce((at, one) => (one.img === undefined ? at : (images.push([at, at + one.img.length]), at)) + (one.img ?? one).length, 0);

    // And on the last line of a file that ends without a newline, which the
    // declarations written after the markup share.
    for (const ending of ['\n', '']) {
        const text = `<script lang="python">\nlabel = "Hello"\npicture = "p.png"\n</script>\n\n${markup}${ending}`;
        const api = configured();
        const { code, map } = await preprocess(text, [python()], { filename });
        const { compiled } = await api.compileSvelte({ filename }, code, api.options, undefined, map);
        const placed = compiled.warnings.filter((one) => one.code === 'a11y_missing_attribute');

        expect(placed.map(({ start, end }) => [start.line, start.column, end.column])).toEqual(images.map(([start, end]) => [6, start, end]));
    }
});

// Two variants of one file, preprocessed under its name before either is
// compiled: each warning is placed on its own text.
test('two variants of one file are placed each on its own text', async () => {
    const filename = '/app/src/Variant.svelte';
    const api = configured();
    const lines = [line, `<p>{count + 1}</p><img src={pic}>`];
    const codes = await Promise.all(lines.map((one) => preprocessed(`${script}${one}\n`, filename)));

    expect([(await warned(api, codes[0], filename)).start.column, (await warned(api, codes[1], filename)).start.column]).toEqual(lines.map((one) => one.indexOf('<img')));
});
