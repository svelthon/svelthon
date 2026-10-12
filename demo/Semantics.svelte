<script lang="python">
floor = -7 // 2                               # JS: -3.5
big = 2 ** 70                                 # JS: 1.18e+21
words = ", ".join(sorted({"pear", "apple"}))  # JS: no set
ratio = tojson({"third": 1 / 3})              # a float leaving Python
</script>

<output>{floor}</output>
<output>{big}</output>
<output>{words}</output>
<output>{ratio}</output>
