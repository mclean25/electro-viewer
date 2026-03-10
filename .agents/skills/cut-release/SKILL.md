---
name: cut-release
description: Generate GitHub release notes from merged pull requests since the last git tag, then create a GitHub release for this repository. Use when the user wants to cut a release, preview or draft release notes, determine the next release tag, or publish a new version on GitHub.
---

Create a GitHub release for this repository. If the caller provides an
optional `[tag-name]` argument, use that exact value as the release tag.
Otherwise, derive the tag from the `version` field on GitHub `master`.

Follow these steps:

## Step 1: Gather context

Use `master` as the source branch for release history and tags.

```
git tag --merged master --sort=-version:refname | head -5
```

Then determine the baseline tag on `master`:

```
git describe --tags --abbrev=0 master
```

Then gather merged PRs since the baseline tag:

```
tag_time="$(git log -1 --format=%cI <last-tag>)"
tag_date="$(git log -1 --format=%cs <last-tag>)"
gh pr list \
  --state merged \
  --base master \
  --search "merged:>=$tag_date" \
  --limit 200 \
  --json number,title,url,author,mergedAt \
  --jq '[.[] | select(.mergedAt > "'"$tag_time"'")]'
```

Check whether that filtered PR list is empty:

```bash
pr_count="$(gh pr list \
  --state merged \
  --base master \
  --search "merged:>=$tag_date" \
  --limit 200 \
  --json mergedAt \
  --jq '[.[] | select(.mergedAt > "'"$tag_time"'")] | length')"
```

If `pr_count` is `0`, stop and report that there is nothing to release.

## Step 2: Draft release notes

Organize the merged PRs into a clean GitHub release message using this
structure, summarizing and grouping them where appropriate to get the point
across:

```markdown
## What's Changed

### Features
- ...

### Bug Fixes
- ...

### Improvements
- ...

### Other Changes
- ...
```

Only include sections that have relevant PRs. Keep bullet points concise and
human-readable — rewrite terse PR titles into plain English where needed.
For each bullet, include the PR link and author attribution as `@{author}`.

Use this command to print candidate bullets from merged PRs:

```bash
gh pr list \
  --state merged \
  --base master \
  --search "merged:>=$tag_date" \
  --limit 200 \
  --json number,title,url,author,mergedAt \
  --jq '.[] | select(.mergedAt > "'"$tag_time"'") | "- \(.title) ([#\(.number)](\(.url))) @\(.author.login)"'
```

Preferred bullet format:

```markdown
- Add X workflow for Y ([#123](https://github.com/<owner>/<repo>/pull/123))
  @alice
```

## Step 3: Determine the release version from GitHub `master`

If the user passed `[tag-name]`, use it as the tag name.

Otherwise, fetch `package.json` from the current HEAD commit of the GitHub
`master` branch and derive the tag from that version instead of using the local
checkout. Do not use the local `package.json` version for the release
decision.

Instead, decode the fetched `package.json` content and extract the `version`
field. The release tag should be `v{version}`. For example, if the GitHub
`master` branch has `"version": "0.1.19"`, the tag must be `v0.1.19`.

Use this exact command to extract the version without relying on the local
working tree:

```bash
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
master_sha="$(gh api "repos/$repo/git/ref/heads/master" --jq .object.sha)"
version="$(
  gh api "repos/$repo/contents/package.json?ref=$master_sha" --jq '.content' \
    | tr -d '\n' \
    | base64 --decode \
    | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
)"
tag="v$version"
```

Before creating the release, check whether that release already exists on
GitHub:

```bash
gh release view "$tag"
```

If that command succeeds, stop and tell the user that release `"$tag"` already
exists, so they need to update `package.json`, merge that version bump to
GitHub `master`, and then run the release again.

## Step 4: Show a preview and confirm

Write release notes to a temp markdown file and preview the exact command.
Print the proposed tag name and the full release notes markdown to the user for
review. Ask for confirmation before creating the release.

Use this command format:

```
gh release create <tag> --title "<tag>" --notes-file /tmp/release-notes.md
```

## Step 5: Create the GitHub release

Once confirmed, run the previewed command.

If creating a draft first is preferred, add `--draft`.

After creating, output the release URL.
