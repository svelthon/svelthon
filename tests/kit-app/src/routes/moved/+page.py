# And its `redirect()`, from a universal route module.
__js__ = {"@sveltejs/kit": ["redirect"]}


def load(event):
    redirect(303, "/load")
