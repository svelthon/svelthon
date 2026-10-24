<script>
    // The witness: the same lines in Svelte, the `:=` aside, and the effect's
    // name a variable of its own.
    let base = $state(1);
    let a = $derived(base * 2); let b = $derived(base * 3); a = 99;
    let c = $derived(base * 4); let d = $derived(base * 5); c = () => 7;
    let e = $derived(base * 6); let f = $derived(base * 7);
    let x = 99;

    export const held = () => `${a} ${b} ${typeof c === 'function' ? 'True' : 'False'} ${d} ${e} ${f} ${x}`;
    export function bump() {
        base += 1;
    }
</script>

<p data-k="shown">{a} {b} {d} {e} {f}</p>
