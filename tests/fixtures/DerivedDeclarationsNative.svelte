<script>
    // The witness: the same writes to Svelte's own deriveds, two of them for
    // the two targets, and one JavaScript cannot write before its declaration.
    let base = $state(1);
    let other = $derived(base * 10);

    function decorate(fn) {
        other = 99;
        return fn;
    }

    let doubled = $derived.by(decorate(() => base * 2));
    let first = $derived.by(() => base * 3);
    let second = $derived.by(() => base * 3);
    let written = $derived.by(() => base * 4);

    export const held = () => `${other} ${doubled} ${first} ${second} ${written}`;
    export function bump() {
        base += 1;
    }
</script>

<p data-k="shown">{other} {doubled} {first} {second} {written}</p>
