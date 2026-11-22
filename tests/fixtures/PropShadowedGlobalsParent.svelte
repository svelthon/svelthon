<script>
    import PropShadowedGlobals from './PropShadowedGlobals.svelte';

    const record = $state({ ticket: 't1' });

    export function next(ticket) {
        record.ticket = ticket;
    }
</script>

<PropShadowedGlobals ticket={record.ticket} />
