<script module>
    // Rune names bound by the author's module script, read by Python, exported.
    export const derived = (value) => value * 2;
    export function state(value) {
        const twice = { derived };
        return twice.derived(value) + ((derived) => derived)(1);
    }
    const effect = { derived: 3 };
    export { effect };
</script>

<script lang="python">
count = 3
items = [1, 2]
</script>

<p>{count}{#each items as item}<b>{item}</b>{/each}|{derived(count)}|{state(count)}|{effect["derived"]}</p>
