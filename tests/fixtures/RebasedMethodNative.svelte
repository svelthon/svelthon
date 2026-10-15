<script>
    // RebasedMethod in Svelte: the base an object answers from, and what each
    // base answers, held in state.
    let base = $state('first');
    let second = $state(2);

    const length = () => (base === 'first' ? 1 : second);

    export function migrate() {
        base = 'second';
    }

    export function change() {
        second = 99;
    }

    export function model() {
        return length();
    }
</script>

<output>{length()}</output>
