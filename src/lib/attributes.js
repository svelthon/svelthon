// How the DOM and Svelte read an attribute, by its name: the one table both
// the markup pass, which sees the name where it is written, and the runtime,
// which sees it only in a spread, consult.

// The boolean attributes, which the DOM reads for truth: on an element,
// `disabled={[]}` has to be Python's false, as `{#if []}` is. Svelte's own list,
// `DOM_BOOLEAN_ATTRIBUTES` in `svelte/src/utils.js`, the one its compiler and
// its server renderer read, which no public path exports: a name written here
// by hand, and not there, let an empty list through as JavaScript's true.
// `tests/attributes.test.js` holds the two lists equal. Then `hidden`, which
// Svelte reads as a plain value, below.
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

const BOOLEAN_ATTRIBUTE = new RegExp(`^(?:${BOOLEAN_ATTRIBUTES.join('|')})$`, 'i');

// The wrapper an element's attribute of that name goes through, or null for
// one read as a plain value: `class`, which Svelte hands to `clsx`, and the
// boolean attributes, which the DOM reads for truth. `hidden` is one, with a
// third state besides: `until-found`, a string the element keeps.
export const attributeWrapper = (name) =>
    name === 'class'
        ? '__class'
        : /^hidden$/i.test(name)
          ? '__hidden'
          : BOOLEAN_ATTRIBUTE.test(name)
            ? '__truthy'
            : null;
