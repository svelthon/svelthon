<svelte:options customElement={{
    tag: 'flag-element',
    shadow: 'none',
    props: {
        reflected: { reflect: true },
        renamed: { attribute: 'active' },
        empty: {},
        both: { reflect: true, attribute: 'both-on' },
        spelled: { type: 'String' },
    },
}} />

<script lang="python">
# Flags whose entries configure something else than their type, which their
# annotation names; and one whose entry asks for a string, which it keeps. The
# witness is `FlagElementNative.svelte`.
reflected: bool = False
renamed: bool = False
empty: bool = False
both: bool = False
spelled: bool = False
</script>

<p>{"on" if reflected else "off"}|{"on" if renamed else "off"}|{"on" if empty else "off"}|{"on" if both else "off"}|{"on" if spelled else "off"}</p>
