<script lang="python">
items = ["a", "b", "c"]
empty = []
empty_dict = {}
nothing = None
zero = 0
text = ""
mapping = {"x": 1}
</script>

<p data-k="empty">{#if empty}vrai{:else}faux{/if}</p>
<p data-k="empty_dict">{#if empty_dict}vrai{:else}faux{/if}</p>
<p data-k="none">{#if nothing}vrai{:else}faux{/if}</p>
<p data-k="zero">{#if zero}vrai{:else}faux{/if}</p>
<p data-k="text">{#if text}vrai{:else}faux{/if}</p>
<p data-k="items">{#if items}vrai{:else}faux{/if}</p>
<p data-k="elseif">{#if empty}a{:else if items}b{:else}c{/if}</p>
<p data-k="nested">{#if items}{#if empty}x{:else}y{/if}{/if}</p>
<p data-k="raw_list">{items}</p>
<p data-k="raw_dict">{mapping}</p>
<p data-k="raw_none">{nothing}</p>
<p data-k="attr" data-v={items}>attr</p>
<p data-k="str_list">{py.str(items)}</p>
<p data-k="str_dict">{py.str(mapping)}</p>
<ul data-k="each">{#each items as it}<li>{it}</li>{/each}</ul>
