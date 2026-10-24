<svelte:options customElement={{
    tag: 'flag-element-native',
    shadow: 'none',
    props: {
        reflected: { reflect: true },
        renamed: { attribute: 'active' },
        empty: {},
        both: { reflect: true, attribute: 'both-on' },
        spelled: { type: 'String' },
    },
}} />

<script>
    // The witness: Svelte infers the flags' type from their defaults.
    let { reflected = false, renamed = false, empty = false, both = false, spelled = false } = $props();
</script>

<p>{reflected ? 'on' : 'off'}|{renamed ? 'on' : 'off'}|{empty ? 'on' : 'off'}|{both ? 'on' : 'off'}|{spelled ? 'on' : 'off'}</p>
