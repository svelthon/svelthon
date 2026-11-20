<script module lang="ts">
    // A namespace named like a rune, and one whose body reads a constant named
    // like one, and declares its own.
    export const state = { Ready: 7 };
    export namespace derived { export const total = 8; }
    export namespace Totals {
        export const total = state.Ready;
        export const effect = 'own';
    }
</script>

<script lang="python">
count = 1
</script>

<output>{derived.total}|{Totals.total}|{Totals.effect}|{count}</output>
