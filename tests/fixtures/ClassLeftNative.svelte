<script>
    // ClassLeft in Svelte: what the object answers, and what the class it left
    // answers, held in two states.
    import { log, count } from './class_runs.js';

    let answer = $state(2);
    let left = $state(1);

    $effect(() => {
        log(answer);
        if (count() < 4) left = 99;
    });

    export function change() {
        answer = 99;
    }
</script>

<output>{answer}</output>
