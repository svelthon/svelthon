<script lang="python">
# Every name the compiler publishes into a component's namespace, declared here
# by the author instead. Each must come back as the value written below: the
# injection steps aside, exactly as a Python module defining `list` shadows the
# builtin and loses it.
#
# The decorators are not here: they are locked, and declaring one is refused at
# compile time rather than shadowed. See LockedName.svelte.
#
# `js` is the one that found the bug. It had no guard at all, so a name declared
# here was replaced by the bridge to the JavaScript globals — silently, and the
# component read `globalThis` where it had written a string.
to_js = "mine to_js"
to_py = "mine to_py"
to_json = "mine to_json"
from_json = "mine from_json"
js = "mine js"
batch = "mine batch"
date = "mine date"
from_now = "mine from_now"
slugify = "mine slugify"
strip_tags = "mine strip_tags"
urlencode = "mine urlencode"
set_context = "mine set_context"
get_context = "mine get_context"
props_id = "mine props_id"
host = "mine host"
</script>

<p data-k="to_js">{to_js}</p>
<p data-k="to_py">{to_py}</p>
<p data-k="to_json">{to_json}</p>
<p data-k="from_json">{from_json}</p>
<p data-k="js">{js}</p>
<p data-k="batch">{batch}</p>
<p data-k="date">{date}</p>
<p data-k="from_now">{from_now}</p>
<p data-k="slugify">{slugify}</p>
<p data-k="strip_tags">{strip_tags}</p>
<p data-k="urlencode">{urlencode}</p>
<p data-k="set_context">{set_context}</p>
<p data-k="get_context">{get_context}</p>
<p data-k="props_id">{props_id}</p>
<p data-k="host">{host}</p>
