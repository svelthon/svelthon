// How the DOM and Svelte read an attribute, by its name: the one table both
// the markup pass, which sees the name where it is written, and the runtime,
// which sees it only in a spread, consult.

// The boolean attributes of HTML, which the DOM reads for truth: on an element,
// `hidden={[]}` has to be Python's false, as `{#if []}` is.
export const BOOLEAN_ATTRIBUTE =
    /^(?:allowfullscreen|async|autofocus|autoplay|checked|controls|default|defer|disabled|formnovalidate|hidden|inert|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected)$/i;

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
