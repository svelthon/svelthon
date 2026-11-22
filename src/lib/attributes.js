// How the DOM and Svelte read an attribute, by its name: the one table both
// the markup pass, which sees the name where it is written, and the runtime,
// which sees it only in a spread, consult.

// The boolean attributes, which the DOM reads for truth: on an element,
// `disabled={[]}` has to be Python's false, as `{#if []}` is. Svelte's own list,
// `DOM_BOOLEAN_ATTRIBUTES` in `svelte/src/utils.js`, the one its compiler and
// its server renderer read, which no public path exports, so it is copied here
// and `tests/attributes.test.js` holds the two lists equal. Then `hidden`,
// which Svelte reads as a plain value, below.
export const BOOLEAN_ATTRIBUTES = [
    'allowfullscreen',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'disabled',
    'formnovalidate',
    'indeterminate',
    'inert',
    'ismap',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'seamless',
    'selected',
    'webkitdirectory',
    'defer',
    'disablepictureinpicture',
    'disableremoteplayback'
];

// And the boolean properties Svelte sets on an element under a name no
// attribute spells, from `DOM_PROPERTIES` in the same file: `defaultChecked`,
// what a form's reset puts back, whose attribute is `checked`. Its others,
// `readOnly` or `noValidate`, are names of the list above in another case,
// which the table reads as one; `value`, `volume`, `defaultValue` and
// `srcObject` are values. `tests/attributes.test.js` holds that true.
export const BOOLEAN_PROPERTIES = ['defaultChecked'];

const BOOLEAN_ATTRIBUTE = new RegExp(`^(?:${[...BOOLEAN_ATTRIBUTES, ...BOOLEAN_PROPERTIES].join('|')})$`, 'i');

// The wrapper an element's attribute of that name goes through, or null for
// one read as a plain value: `class`, which Svelte hands to `clsx`, and the
// boolean attributes, which the DOM reads for truth. `hidden` is one, with a
// third state besides: `until-found`, a string the element keeps.
export const attributeWrapper = (name) =>
    name === 'class'
        ? '__brycomp_class'
        : /^hidden$/i.test(name)
          ? '__brycomp_hidden'
          : BOOLEAN_ATTRIBUTE.test(name)
            ? '__brycomp_truthy'
            : null;

// The bindings Svelte reads for truth, `input.checked = Boolean(value)` and
// `!!get()` for `paused`: the boolean attributes it binds, `checked`,
// `indeterminate`, `open` and `muted`, and `paused`, a state of a media element
// no attribute spells. On an element, `bind:checked={[]}` is Python's false, as
// `checked={[]}` is.
export const truthBinding = (name) => name === 'paused' || BOOLEAN_ATTRIBUTE.test(name);
