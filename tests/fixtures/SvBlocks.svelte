<script lang="python">
raw = "<b>bold</b>"
items = ["a", "b"]
flag = True
n = 3
color = "red"
</script>

<p data-k="html">{@html raw}</p>
<p data-k="const">{#each items as it}{@const up = it + "!"}[{up}]{/each}</p>
<p data-k="key">{#key n}k{n}{/key}</p>
<p data-k="classdir" class:on={flag}>c</p>
<p data-k="styledir" style:color={color}>s</p>
<p data-k="eachidx">{#each items as it, i}[{i}:{it}]{/each}</p>
<p data-k="eachelse">{#each [] as it}x{:else}empty{/each}</p>
