<script lang="python">
# Targets of a template `:=` with blanks before a step, which Python allows.
class Box:
    pass


first = Box()
first.value = "before"
second = Box()
second.value = "before"
items = ["before"]
holder = [Box()]
holder[0].value = "before"
nested = Box()
nested.items = ["before"]
outer = [nested]
indexed = ["before", "before"]
index = 1
lined = Box()
lined.value = "before"
broken = ["before"]
</script>

<button data-k="dot" onclick={lambda: (first .value := "after")}>dot</button>
<button data-k="spaced" onclick={lambda: (second . value := "after")}>spaced</button>
<button data-k="bracket" onclick={lambda: (items [0] := "after")}>bracket</button>
<button data-k="both" onclick={lambda: (holder [0] . value := "after")}>both</button>
<button data-k="deep" onclick={lambda: (outer[0].items [0] := "after")}>deep</button>
<button data-k="index" onclick={lambda: (indexed [index] := "after")}>index</button>
<button data-k="line-dot" onclick={lambda: (lined
    .value := "after")}>line-dot</button>
<button data-k="line-bracket" onclick={lambda: (broken
    [0] := "after")}>line-bracket</button>
<output>{first.value}|{second.value}|{items[0]}|{holder[0].value}|{outer[0].items[0]}|{indexed[1]}|{lined.value}|{broken[0]}</output>
