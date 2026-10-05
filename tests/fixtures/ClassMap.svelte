<script lang="python">
# Classes handed over by a JavaScript parent, on an element directly and
# through a spread. The witness is `ClassMapNative.svelte`.
classes: object = None
</script>

<p data-k="direct" class={classes}>hi</p>
<p data-k="spread" {**{"class": classes}}>hi</p>
