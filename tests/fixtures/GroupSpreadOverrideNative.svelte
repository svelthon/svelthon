<script>
    // The same box in Svelte, its `value` an object of its own: the witness for
    // GroupSpreadOverride.
    let { kind = 'count', control = 'checkbox', spread = true } = $props();

    class Valued {
        constructor(value) {
            this.value = value;
        }

        toString() {
            return String(this.value);
        }
    }

    const initial = () => {
        const plain = kind === 'count' ? 1 : 'yes';

        return { original: new Valued(plain), attrs: spread ? { value: plain } : {}, start: control === 'checkbox' ? [] : null };
    };

    const { original, attrs, start } = initial();

    let picked = $state.raw(start);

    export function written() {
        const one = control === 'checkbox' ? picked[0] : picked;

        return [one === original];
    }
</script>

{#if control === 'checkbox'}<input type="checkbox" value={original} {...attrs} bind:group={picked} />
{:else}<input type="radio" value={original} {...attrs} bind:group={picked} />{/if}
