// A table of `test.for` whose rows are strings, handed to a callback that reads
// its row as an array, `([kind]) => …`, runs every case on the first letter of
// its name while the title shows the whole: three tables did, and passed on
// branches they never took. Refused here, where every table is made.
import { test, it, describe } from 'vitest';

for (const api of [test, it, describe]) {
    const made = api.for;

    api.for = function (table) {
        const scalar = Array.isArray(table) && table.some((row) => row === null || typeof row !== 'object');
        const run = made.call(this, table);

        return function (title, ...rest) {
            const callback = rest.find((one) => typeof one === 'function');

            if (scalar && callback !== undefined && /^\s*(async\s*)?\(\s*\[/.test(String(callback))) {
                throw new TypeError(`${title}: its rows are no arrays, and its callback reads one as an array`);
            }

            return run.call(this, title, ...rest);
        };
    };
}
