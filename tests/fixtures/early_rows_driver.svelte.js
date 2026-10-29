// Called while the rows of a loop are computed: makes a root and destroys it
// at once, so its cleanup reads what Python hands it then.
export const events = [];

export function probe(read, value) {
    const stop = $effect.root(() => {
        $effect.pre(() => {
            events.push(`run:${read()}`);
            return () => events.push(`clean:${read()}`);
        });
    });
    stop();
    return value;
}
