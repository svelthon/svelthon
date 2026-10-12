<script lang="python">
# A date the parent changes in place, shown through each date helper.
stamp: object = None
</script>

<p data-k="date">{date(stamp, "short", None, "en-GB")}</p>
<p data-k="urlencode">{urlencode(stamp)}</p>
<p data-k="fromnow">{fromnow(stamp, "en-GB")}</p>
