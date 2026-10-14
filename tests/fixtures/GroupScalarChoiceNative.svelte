<script>
    // The same choices in Svelte, the witness for GroupScalarChoice: NaN
    // itself, an object standing for each instance of a subclass, which only
    // itself is, and the plain values. Raw, so the model holds the choice
    // itself, as the Python one does.
    let { kind = 'nan', control = 'checkbox' } = $props();

    class Valued {
        constructor(value) {
            this.value = value;
        }

        toString() {
            return String(this.value);
        }
    }

    const initial = () => {
        const choice = {
            nan: NaN,
            price: new Valued(0.5),
            count: new Valued(1),
            label: new Valued('yes'),
            float: 0.5,
            int: 1,
            str: 'yes'
        }[kind];

        return { choice, picked: control === 'checkbox' ? [choice] : choice };
    };

    const { choice, picked: held } = initial();

    let picked = $state.raw(held);
</script>

{#if control === 'checkbox'}<input type="checkbox" value={choice} bind:group={picked} />
{:else}<input type="radio" value={choice} bind:group={picked} />{/if}
