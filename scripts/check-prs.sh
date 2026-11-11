#!/bin/bash
# For each Brython PR named on the command line: its branch, how many commits
# it holds above upstream master, and the "Depends on" lines of its text, read
# from GitHub and git, not from anyone's account of them.
#
#   BRYTHON=path/to/brython bash scripts/check-prs.sh 3167 3072 3066
#
# `BRYTHON` is a Brython checkout whose `upstream` remote is brython-dev's.
cd "${BRYTHON:?set BRYTHON to a Brython checkout}" || exit 1
git fetch -q upstream master
for number in "$@"; do
    git fetch -q upstream "refs/pull/$number/head" || { echo "#$number: no such PR"; continue; }
    sha=$(git rev-parse FETCH_HEAD)
    commits=$(git rev-list --count upstream/master.."$sha")
    body=$(curl -s "https://api.github.com/repos/brython-dev/brython/pulls/$number")
    branch=$(printf '%s' "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("head", {}).get("ref", "?"))' 2>/dev/null)
    depends=$(printf '%s' "$body" | python3 -c 'import json,re,sys; print(" ".join(re.findall(r"Depends on #\d+", json.load(sys.stdin).get("body") or "")) or "no Depends on")' 2>/dev/null)
    [ "$branch" == "?" ] && depends="text unread: GitHub API limit reached, retry in an hour"
    echo "#$number $branch: $commits commit(s), $depends"
done
