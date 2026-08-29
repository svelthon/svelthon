<script lang="python">
# Every name the compiler publishes into a component's namespace, declared here
# by the author instead. Each must come back as the value written below: the
# injection steps aside, exactly as a Python module defining `list` shadows the
# builtin and loses it.
#
# `js` is the one that found the bug. It had no guard at all, so a name declared
# here was replaced by the bridge to the JavaScript globals — silently, and the
# component read `globalThis` where it had written a string.
derived = "mine derived"
bindable = "mine bindable"
effect = "mine effect"
to_js = "mine to_js"
to_python = "mine to_python"
tojson = "mine tojson"
js = "mine js"
batch = "mine batch"
date = "mine date"
fromnow = "mine fromnow"
slugify = "mine slugify"
striptags = "mine striptags"
urlencode = "mine urlencode"
set_context = "mine set_context"
get_context = "mine get_context"
props_id = "mine props_id"
</script>

<p data-k="derived">{derived}</p>
<p data-k="bindable">{bindable}</p>
<p data-k="effect">{effect}</p>
<p data-k="to_js">{to_js}</p>
<p data-k="to_python">{to_python}</p>
<p data-k="tojson">{tojson}</p>
<p data-k="js">{js}</p>
<p data-k="batch">{batch}</p>
<p data-k="date">{date}</p>
<p data-k="fromnow">{fromnow}</p>
<p data-k="slugify">{slugify}</p>
<p data-k="striptags">{striptags}</p>
<p data-k="urlencode">{urlencode}</p>
<p data-k="set_context">{set_context}</p>
<p data-k="get_context">{get_context}</p>
<p data-k="props_id">{props_id}</p>
