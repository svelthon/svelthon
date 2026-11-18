<script lang="python">
# An action whose value is read again at each click, the same at the first.
__js__ = {"./action_log.js": ["noted"]}

count = 0


def bump():
    global count
    count += 1
</script>

<div use:noted={count // 2}></div>
<button onclick={bump}>bump</button>
