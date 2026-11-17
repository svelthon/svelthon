# The value of each case read by a page written in JavaScript.
import models

__all__ = ["load"]


def load(event):
    return {"value": models.make(event["params"]["name"])}
