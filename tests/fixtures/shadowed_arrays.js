// JavaScript arrays holding as data a property of the name of a standard method,
// or a constructor of their own: no reader of the array calls the one, nor asks
// the other for the species of a copy.
const holding = (rows, name, kind) => {
    if (kind === 'null') rows[name] = null;
    else if (kind === 'answering') rows[name] = () => [2];
    else if (kind === 'raising') rows[name] = () => { throw new Error('not a method') };
    else if (kind === 'constructor') rows.constructor = null;
    else if (kind === 'species') rows.constructor = { [Symbol.species]: Uint8Array };
    else if (kind === 'throwing species') rows.constructor = { get [Symbol.species]() { throw new Error('not read') } };

    return rows;
};

export const shadowed = (kind, classes = false) => holding(classes ? ['picked'] : [1], classes ? 'filter' : 'map', kind);

// Three items for a helper that groups them, holding a `slice`.
export const grouped = (kind) => holding([1, 2, 3], 'slice', kind);
