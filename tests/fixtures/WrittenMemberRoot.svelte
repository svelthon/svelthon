<script>
    // An object no state holds, replaced by another as the count changes: to
    // Python children that write a field of it through `globals()`, and to
    // their twin.
    import WrittenMemberIndexed from './WrittenMemberIndexed.svelte';
    import WrittenMemberLookup from './WrittenMemberLookup.svelte';
    import WrittenMemberNative from './WrittenMemberNative.svelte';

    const models = Array.from({ length: 3 }, () => ({ ticket: { label: 'A' } }));
    const first = models.map((model) => model.ticket);
    let revision = $state(0);

    export function labels() {
        return { first: first.map((ticket) => ticket.label), current: models.map((model) => model.ticket.label) };
    }

    export function revise(label) {
        for (const one of models) one.ticket = { label };
        revision += 1;
    }
</script>

<div data-k="indexed"><WrittenMemberIndexed ticket={models[0].ticket} {revision} /></div>
<div data-k="lookup"><WrittenMemberLookup ticket={models[1].ticket} {revision} /></div>
<div data-k="native"><WrittenMemberNative ticket={models[2].ticket} {revision} /></div>
