<script>
    // MetaClassRead in Svelte: what the class answers, held in state.
    let answer = $state(1);

    export function change() {
        answer = 99;
    }

    export function model() {
        return answer;
    }
</script>

<output>{answer}</output>
