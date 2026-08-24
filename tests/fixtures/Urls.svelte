<script lang="python">
# The word the three engines share, with the platform behind it — and without
# the `/` that Django and Jinja both leave through.
tag = "a/b"
query = "café & thé"
page = 2
</script>

<p data-k="piece">{urlencode(query)}</p>
<p data-k="slash">{urlencode(tag)}</p>
<p data-k="query">{urlencode({"q": query, "page": page})}</p>
<p data-k="slash-in-dict">{urlencode({"p": tag})}</p>
<p data-k="number">{urlencode(703)}</p>
<a data-k="link" href="/search?{urlencode({'q': query})}">search</a>
<a data-k="path" href="/tag/{urlencode(tag)}">tag</a>
