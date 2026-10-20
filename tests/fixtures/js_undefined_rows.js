// The rows JsUndefinedDefault reads: a plain record, one with an `ob_type`
// field, one whose `value` is a getter, and a function carrying `value` as its
// own member, with `value` missing, `undefined`, `null` or set, and what the
// default makes of each.
export const CONTENTS = [
    ['absent', '7'],
    ['undefined', '7'],
    ['null', '<Javascript null>'],
    ['set', '5']
];

export const cases = ['Python', 'Svelte'].flatMap((language) =>
    ['each', 'snippet', 'await'].flatMap((place) =>
        ['plain', 'ob_type', 'getter', 'function'].flatMap((shape) =>
            CONTENTS.map(([content, shown]) => [language, place, shape, content, shown])
        )
    )
);

export const row = (shape, content, read) => {
    const made = shape === 'ob_type' ? { ob_type: 'business' } : shape === 'function' ? function item() {} : {};

    if (content === 'absent') return made;

    const value = { undefined: undefined, null: null, set: 5 }[content];

    if (shape === 'getter') {
        Object.defineProperty(made, 'value', {
            enumerable: true,
            get() {
                read();
                return value;
            }
        });
    } else {
        made.value = value;
    }

    return made;
};
