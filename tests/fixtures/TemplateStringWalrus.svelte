<script lang="python">
count = 0
shown = ""
caption = "Ada"


class Row:
    name = "Grace"


row = Row()


def show(t):
    global shown
    parts = [(one.expression, one.value, one.conversion, one.format_spec) for one in t.interpolations]
    shown = f"{t.strings!r}|{parts!r}"
</script>

<button data-k="plain" onclick={lambda: show(t"left {(count := count + 1)} right")}>plain</button>
<button data-k="debug" onclick={lambda: show(t"{(count := count + 1)=}")}>debug</button>
<button data-k="converted" onclick={lambda: show(t"{(count := count + 1)=!s}")}>converted</button>
<button data-k="formatted" onclick={lambda: show(t"{(count := count + 1):>3}")}>formatted</button>
<button data-k="first" onclick={lambda: show(t"left {(count := count + 1)=}" t" / {caption} right")}>first</button>
<button data-k="last" onclick={lambda: show(t"left {caption} / "  t"{(count := count + 1)} right")}>last</button>
<button data-k="both" onclick={lambda: show(t"{(count := count + 1)}"
    # between
    t"{(count := count + 1)}")}>both</button>
<button data-k="before" onclick={lambda: show(t"left {caption=} / {(count := count + 1)=} right")}>before</button>
<button data-k="after" onclick={lambda: show(t"{(count := count + 1)} / {caption=!s}")}>after</button>
<button data-k="dotted" onclick={lambda: show(t"{row.name=} {(count := count + 1)}")}>dotted</button>
<button data-k="named" onclick={lambda: show(t"left \N{GREEK SMALL LETTER PI} {caption=} / {(count := count + 1)=} right")}>named</button>
<button data-k="namedNext" onclick={lambda: show(t"\N{BULLET} {(count := count + 1)}" t" {caption}")}>namedNext</button>
<button data-k="commented" onclick={lambda: show(t"""{(count := count + 1) # note
=} {caption # who
}""")}>commented</button>
<p data-k="shown">{shown}</p>
