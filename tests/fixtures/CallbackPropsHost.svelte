<script>
    import Confirm from './CallbackPropsConfirm.svelte';
    import ConfirmPython from './CallbackPropsConfirmPython.svelte';
    import Relay from './CallbackPropsRelay.svelte';
    import HeldRelay from './CallbackPropsHeldRelay.svelte';

    const config = { choice: 'A', confirm: () => 'A' };
    let revision = $state(0);

    export function select(choice) {
        config.choice = choice;
        config.confirm = () => choice;
        revision += 1;
    }
</script>

<section data-k="direct"><Relay {revision} {config} /></section>
<section data-k="direct-python"><Relay {revision} {config} python={true} /></section>
<section data-k="held"><HeldRelay Picked={Confirm} {revision} {config} /></section>
<section data-k="held-python"><HeldRelay Picked={ConfirmPython} {revision} {config} /></section>
