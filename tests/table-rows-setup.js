// A table of `test.for` whose rows are strings, handed to a callback that reads
// its row as an array, `([kind]) => …`, runs every case on the first letter of
// its name while the title shows the whole: three tables did, and passed on
// branches they never took. Refused here, where every table is made.
//
// A table written as a template, `` test.for`a | b ${1} | ${2}` ``, is handed
// on with its values, and its rows are objects. And every modifier's `.for`,
// `test.skip.for` and the rest, is the guarded one: Vitest makes the chain of
// a modifier as it is asked for, copying the properties of its base function
// (`fn`), which is where the guard goes.
import { test, it, describe } from 'vitest';

const guarded = (made) =>
    function (table, ...values) {
        const template = values.length > 0 || Array.isArray(table?.raw);
        const scalar = !template && Array.isArray(table) && table.some((row) => row === null || typeof row !== 'object');
        const run = made.call(this, table, ...values);

        return function (title, ...rest) {
            const callback = rest.find((one) => typeof one === 'function');

            if (scalar && callback !== undefined && /^\s*(async\s*)?\(\s*\[/.test(String(callback))) {
                throw new TypeError(`${title}: its rows are no arrays, and its callback reads one as an array`);
            }

            return run.call(this, title, ...rest);
        };
    };

for (const api of new Set([test, it, describe])) {
    api.fn.for = guarded(api.fn.for);
    api.for = api.fn.for;
}
