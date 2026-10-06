// A config as a JavaScript library hands one back: a stored field beside a
// getter nobody needs to read, which counts its reads and, for `raising`,
// throws when read.
let reads = 0;

export const reset = () => {
    reads = 0;
};

export const readCount = () => reads;

export function make(kind = 'counting') {
    const value = { duration: 0 };

    Object.defineProperty(value, 'unused', {
        enumerable: kind !== 'hidden',
        get() {
            reads += 1;
            if (kind === 'raising') throw new Error('unused field read');
            return 42;
        }
    });

    return value;
}

export function action(node) {
    node.dataset.installed = 'yes';

    return make('raising');
}
