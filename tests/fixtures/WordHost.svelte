<script lang="python">
# The word, in a string, in the places an ordinary program writes it. None of
# them is a read of the injected `host`, and a component that held any of them
# used to emit `$host()` and fail to compile outside a custom element.
role = "host"
roles = ["host", "guest"]
rooms = {"host": 1}
label = f"{role} of the room"
</script>

<p data-k="role">{role}</p>
<p data-k="roles">{roles}</p>
<p data-k="rooms">{rooms["host"]}</p>
<p data-k="label">{label}</p>
