<script lang="python">
# Every shape a handler's signature can take. The DOM offers one argument, the
# event, and each of these has to receive exactly what Python would give it: a
# `def` of no parameters must not be handed the event, and a `*args` must be
# handed everything there is.
#
# The arity is read off Brython's `$function_infos`, positions 8 and 10, which
# is its layout rather than its API.
seen = "-"

def bare():
    global seen
    seen = "bare/0"

def plain(event):
    global seen
    seen = "plain/" + type(event).__name__

def defaulted(event, extra=None):
    global seen
    seen = "defaulted/" + type(event).__name__ + "/" + str(extra)

def starred(*rest):
    global seen
    seen = "starred/" + str(len(rest)) + "/" + type(rest[0]).__name__

def keyword_only(event, *, tag="t"):
    global seen
    seen = "keyword_only/" + type(event).__name__ + "/" + tag
</script>

<p data-k="seen">{seen}</p>

<button data-k="bare" onclick={bare}>bare</button>
<button data-k="plain" onclick={plain}>plain</button>
<button data-k="defaulted" onclick={defaulted}>defaulted</button>
<button data-k="starred" onclick={starred}>starred</button>
<button data-k="keyword_only" onclick={keyword_only}>keyword_only</button>
