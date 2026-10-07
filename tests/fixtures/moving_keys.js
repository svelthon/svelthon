// Keys whose name is what their `toString` answers, which counts its calls.
let calls = 0;

export const conversions = () => calls;
export const resetConversions = () => {
    calls = 0;
};

export const named = (label) => ({
    label,
    toString() {
        calls += 1;
        return this.label;
    }
});

export const inner = named('before');
export const first = named('first');
export const second = named('second');
export const third = named('first');
export const unseen = named('before');
export const seen = named('before');
export const late = named('before');
export const cleared = named('before');
export const many = Array.from({ length: 400 }, (_, i) => named(`k${i}`));
