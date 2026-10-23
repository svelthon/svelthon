<script>
    // Both variants of the Python file and of its witness, at once.
    import Alpha from './Variant.svelte?variant=alpha';
    import Beta from './Variant.svelte?variant=beta';
    import AlphaNative from './VariantNative.svelte?variant=alpha';
    import BetaNative from './VariantNative.svelte?variant=beta';
</script>

<div class="python"><Alpha /><Beta /></div>
<div class="native"><AlphaNative /><BetaNative /></div>
