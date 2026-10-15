// An array whose iteration is a generator of its own, which counts its walks
// and yields what the count makes: 10 and 11 on the first, 20 and 21 on the
// second. Or one whose `Symbol.iterator` is a getter, which counts its reads
// and hands each a generator of what that count makes.
let walks = 0;
let looks = 0;

export const walked = () => walks;
export const looked = () => looks;

export function makeRows(kind = 'own') {
    walks = 0;
    looks = 0;

    const rows = [1, 2];

    if (kind === 'getter') {
        Object.defineProperty(rows, Symbol.iterator, {
            get() {
                const look = ++looks;

                return function* () {
                    walks += 1;
                    yield look * 10;
                    yield look * 10 + 1;
                };
            }
        });

        return rows;
    }

    rows[Symbol.iterator] = function* () {
        walks += 1;
        yield walks * 10;
        yield walks * 10 + 1;
    };

    return rows;
}
