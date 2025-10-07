# Docs

The docs index is the [README](./README.md), it leads to multiple `md` files that can help you in your task.

# Web

In the web folder lives a NextJS project. When debugging the frontend use your `browser_*` tools. The website lives on http://localhost:3001.

If you can't access it, it may be the user the forgot to launch it: ask him to do so.

# Github

The project code is hosted on Github. We use the issue tracker and the PR tab.

You have access to the `gh` CLI to explore the repo.

When looking at issues/PR, if images are attached, you can access them with the command: `TOKEN=$(gh auth token) && curl -L -H "Authorization: token $TOKEN" -o /tmp/image.png $IMAGE_URL`