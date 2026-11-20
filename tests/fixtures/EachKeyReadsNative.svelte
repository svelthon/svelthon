<script>
    // The witness of `EachKeyReads.svelte`, in Svelte.
    import { rows } from './key-reads.js';

    let revision = $state(0);
    const current = (_revision) => rows;

    export function step() {
        revision += 1;
    }
</script>

{#each current(revision) as row (row.id)}<input value="draft" />{/each}
