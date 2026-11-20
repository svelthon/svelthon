<script>
    let { amount } = $props();
</script>

<output>{typeof amount}|{typeof amount === 'number' ? amount.toFixed(2) : 'no toFixed'}</output>
