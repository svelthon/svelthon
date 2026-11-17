# An action whose answer holds an iterator the page walks as it renders, which
# SvelteKit writes out after: the browser reads it as it was returned.
__all__ = ["actions"]


def act(event):
    zipped = zip([1, 2, 3], "abc")
    next(zipped)
    return {"value": zipped}


actions = {"default": act}
