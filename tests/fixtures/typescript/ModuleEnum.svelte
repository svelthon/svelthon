<script module lang="ts">
    // An enum named like a rune, exported.
    export enum state { Ready = 7, Later = state.Ready + 1 }
</script>

<script lang="python">
count = 1
</script>

<output>{state.Ready}|{state.Later}|{count}</output>
