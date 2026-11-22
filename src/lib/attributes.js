// How the DOM and Svelte read an attribute, by its name: the one table both
// the markup pass, which sees the name where it is written, and the runtime,
// which sees it only in a spread, consult.
import { CALLS } from './template-names.js';

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

// The values among them, which an element takes as they are: a `volume` its
// number, the `defaultValue` a `<select>` compares its options with, a list for
// one that chooses several, a stream.
export const VALUE_PROPERTIES = ['value', 'volume', 'defaultValue', 'srcObject'];

const BOOLEAN_ATTRIBUTE = new RegExp(`^(?:${[...BOOLEAN_ATTRIBUTES, ...BOOLEAN_PROPERTIES].join('|')})$`, 'i');

// The wrapper an element's attribute of that name goes through, or null for
// one read as a plain value: `class`, which Svelte hands to `clsx`, and the
// boolean attributes, which the DOM reads for truth. `hidden` is one, with a
// third state besides: `until-found`, a string the element keeps.
export const attributeWrapper = (name) =>
    name === 'class'
        ? CALLS.class
        : /^hidden$/i.test(name)
          ? CALLS.hidden
          : BOOLEAN_ATTRIBUTE.test(name)
            ? CALLS.truthy
            : null;

// An attribute of text, which a value alone between braces is written into as
// Python writes it (`__brycomp_attr`): neither `class` nor a truth, nor `style`,
// which Svelte reads itself, nor a property Svelte sets to the value as it is,
// however its name is spelled, as HTML reads a name: `defaultvalue` too.
export const textAttribute = (name) =>
    attributeWrapper(name) === null && !/^style$/i.test(name) && !VALUE_PROPERTIES.some((one) => one.toLowerCase() === String(name).toLowerCase());

// The bindings Svelte reads for truth, `input.checked = Boolean(value)` and
// `!!get()` for `paused`: the boolean attributes it binds, `checked`,
// `indeterminate`, `open` and `muted`, and `paused`, a state of a media element
// no attribute spells. On an element, `bind:checked={[]}` is Python's false, as
// `checked={[]}` is.
export const truthBinding = (name) => name === 'paused' || BOOLEAN_ATTRIBUTE.test(name);
