<script lang="python">
# A block is not a scope in Python: every name below belongs to the module, and
# the only difference between them is indentation.
plain = 0

if True:
    conditional = 0
else:
    unreached = 0

for _i in range(1):
    looped = 0

while False:
    never = 0

try:
    guarded = 0
except Exception:
    handled = 0
finally:
    cleaned = 0

if True:
    if True:
        nested = 0


class Box:
    # A real scope: an attribute, not module state. It must stay out.
    attribute = 0


def shadowed():
    # A real scope too: local, and nothing to do with the name below it.
    local_only = 0
    return local_only


def bump():
    global plain, conditional, unreached, looped, never
    global guarded, handled, cleaned, nested

    plain += 1
    conditional += 1
    unreached = 1
    looped += 1
    never = 1
    guarded += 1
    handled = 1
    cleaned += 1
    nested += 1
</script>

<button onclick={bump}>bump</button>

<p data-k="plain">{plain}</p>
<p data-k="conditional">{conditional}</p>
<p data-k="unreached">{unreached}</p>
<p data-k="looped">{looped}</p>
<p data-k="never">{never}</p>
<p data-k="guarded">{guarded}</p>
<p data-k="handled">{handled}</p>
<p data-k="cleaned">{cleaned}</p>
<p data-k="nested">{nested}</p>
<p data-k="attribute">{Box.attribute}</p>
<p data-k="call">{shadowed()}</p>
