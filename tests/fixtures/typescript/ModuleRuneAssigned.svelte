<script module lang="ts">
    // Functions named like runes behind what TypeScript erases, which names
    // them after their binding once erased.
    export let state: () => string;
    state = (() => 'typed') as () => string;
    export const effect = (() => 1) satisfies () => number;
    export let inspect = (() => 2)!;
    export const names = [state, effect, inspect].map((one) => one.name).join('|');
</script>

<script lang="python">
count = 1
</script>

<output>{names}|{count}</output>
