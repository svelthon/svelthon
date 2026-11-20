<script module lang="ts">
    // Aliases TypeScript binds, named like runes, one of them exported, and a
    // name like no rune's, the witness.
    export namespace Totals { export const total = 9; }
    import effect = Totals.total;
    export import props = Totals;
    export enum Ticket { Ready = 7 }
</script>

<script lang="python">
count = 1
</script>

<output>{effect}|{props.total}|{Ticket.Ready}|{count}</output>
