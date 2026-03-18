# Research Workspace

This repository is a thin workspace wrapper around the main project repos:

- `content`
- `research-tools`
- `wikip.co`

It exists so a new machine or agent can clone one repository and initialize the full working layout with Git submodules.

## Clone

Clone the workspace and its submodules in one step:

```bash
git clone --recursive <workspace-repo-url>
```

If you already cloned the workspace without submodules:

```bash
git submodule update --init --recursive
```

## Update

Pull the workspace repo and then update submodules to the commits recorded by the workspace:

```bash
git pull
git submodule update --init --recursive
```

## Daily Work

Each subdirectory is its own Git repository. Do normal feature work, branching, commits, and PRs inside the submodule you are changing.

If you intentionally want the workspace repo to point at newer submodule commits, update the submodule(s), then commit the changed submodule pointer(s) in the workspace repo.

## Current Submodules

- `content`: `git@github.com:wikip-co/content.git`
- `research-tools`: `git@github.com:wikip-co/research-tools.git`
- `wikip.co`: `git@github.com:wikip-co/wikip.co.git`
