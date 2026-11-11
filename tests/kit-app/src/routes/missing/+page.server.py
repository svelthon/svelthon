# SvelteKit's `error()`, thrown through Python: the framework knows it only as
# it threw it, and answers its status.
__js__ = {"@sveltejs/kit": ["error"]}


def load(event):
    error(404, "nothing under this name")
