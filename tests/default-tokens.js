// What a library does with the callbacks it is handed, for
// `default-tokens.test.js` and its server half: keeps the last, and calls it
// when it is handed the next one.
export const capturing = () => {
    const answers = [];
    let previous;

    return {
        answers,
        capture(fn) {
            if (previous) answers.push(previous());
            previous = fn;
            return fn;
        }
    };
};
