<script>
    import { sharing } from '#lib/label.py';

    let { data } = $props();
</script>

<p data-k="paired">{data.server}|{sharing(data.pair)}</p>
