<script lang="python">
# `py` was reserved back when a template's expressions were still JavaScript:
# `py.truthy(...)` and `py.str(...)` appeared in the markup, so `py` had to be a
# binding in the component's own scope, and a Python name of that spelling
# collided with it. The markup has been Python since; this checks whether the
# reservation still has a reason to exist.
py = "mine"
</script>

<p data-k="py">{py}</p>
