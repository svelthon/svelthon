<script lang="python">
# `date` bound by a walrus inside a lambda is the lambda's own: the helper of
# that name stays the module's.
extract = lambda row: (date if (date := row.get("date")) else "missing")
</script>

<p data-k="lambda">{extract({"date": "kept"})}</p>
<p data-k="helper">{date("2026-09-23", locale="en-GB")}</p>
