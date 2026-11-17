# A layout's data, which its page hands on whole (`+page.server.py`).
import models

__all__ = ["load"]


def load(event):
    return {"value": models.make("tuple"), "top": 1.0}
