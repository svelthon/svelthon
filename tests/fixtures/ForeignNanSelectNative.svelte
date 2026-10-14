<script>
    // The same select in Svelte: the witness for ForeignNanSelect.
    import { values } from './foreign_nan.js';

    let picked = $state(values());

    const choice = values()[0];
</script>

<select multiple bind:value={picked}><option value={choice}>none</option><option value={0.5}>half</option></select>
