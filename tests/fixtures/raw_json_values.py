# What JavaScript wrote by an internal slot, held by Python and handed back.
__js__ = {"./raw_json.js": ["raw", "boxed", "indexed", "tagged", "trapped", "pointed"]}

__all__ = ["kept", "held", "written"]

kept = raw
held = {"raw": raw}


def written():
    return tojson({
        "raw": raw, "boxed": boxed, "indexed": indexed, "tagged": tagged, "trapped": trapped,
        "pointed": pointed(),
    })
