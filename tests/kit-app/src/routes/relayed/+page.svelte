<script>
    let { data } = $props();
</script>

<p data-k="relayed">{data.text}|{data.label.text}</p>
<p data-k="made">{data.made}</p>
<p data-k="changed">{data.changedText}|{data.changed.text}</p>
<p data-k="shelf">{data.shelf}</p>
