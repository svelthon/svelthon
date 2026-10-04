<script>
    import { getContext } from 'svelte';

    const price = getContext('price');
    const whole = getContext('whole');
    const label = getContext('label');
</script>

<p data-k="js">{typeof price}|{price.toFixed(2)}|{typeof whole}|{whole.toFixed(2)}|{typeof label}|{label}</p>
