# A value of each case, from a `load()` and from an action, and a float at the
# top of the data, which SvelteKit holds as a plain object.
import models

__all__ = ["load", "actions"]


def load(event):
    return {"value": models.make(event["params"]["name"]), "top": 1.0}


def act(event):
    return {"value": models.make(event["params"]["name"])}


actions = {"default": act}
