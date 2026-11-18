<script>
    let { revision, choice, onboarding, confirm, onconfirm } = $props();
    let receipt = $state('');
</script>

<output data-k="preview">{revision}|{choice}|{onboarding}</output>
<button onclick={() => (receipt = [choice, onboarding, confirm(), onconfirm()].join('|'))}>Confirm</button>
<output data-k="receipt">{receipt}</output>
