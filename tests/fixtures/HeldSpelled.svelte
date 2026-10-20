<script module>
    // A JavaScript name, which JavaScript keeps as written and Python reads
    // as `Row`.
    import Shelf from './HeldFrame.svelte';

    const Ｒow = Shelf;
</script>

<script lang="python">
    # Children held by a name written as Python reads it otherwise: `Ｃ`, `Ｄ`
    # and `Ｐ` are fullwidth letters, each the ASCII letter once NFKC has read
    # it.
    importjs Card from "./HeldFrame.svelte"
    importjs Frame from "./HeldFrame.svelte"

    Deck = Frame
    Ｐile = Frame
</script>

<div data-k="imported"><Ｃard /></div>
<div data-k="assigned"><Ｄeck /></div>
<div data-k="both"><Ｐile /></div>
<div data-k="javascript"><Ｒow /></div>
