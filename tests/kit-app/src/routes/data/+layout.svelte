<script>
    // The mark the browser check waits for, rather than a delay: the page
    // hydrated (`afterNavigate` runs once mounted) or navigated to.
    import { afterNavigate } from '$app/navigation';

    let { children } = $props();

    afterNavigate(() => {
        document.body.dataset.navigated = String(Number(document.body.dataset.navigated ?? 0) + 1);
    });
</script>

{@render children()}
