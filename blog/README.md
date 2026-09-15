# blog/, converting a finished draft into a real article page

This directory holds the NeoMatrix site's own article pages (Axiom and Vertex posts), separate from Substack.

**A Claude Code skill already does this conversion end to end: `neomatrix-blog-page`, in the shared harness plugin at `C:\Users\admin\Desktop\aifinance\harness\skill\skills\neomatrix-blog-page\SKILL.md`.** Not to be confused with `blog-publish` (that one stages a draft to Substack/X; this one builds this site's own HTML page and never touches Substack). Drop the raw draft into `blog/drafts/axiom/` or `blog/drafts/vertex/` and ask Claude to run it. The steps below are the same contract, kept here as the reference the skill itself follows.

## Input

A finished markdown draft for one Axiom or Vertex post, placed in `blog/drafts/axiom/` or `blog/drafts/vertex/`, plus any images that post needs, dropped into that same folder alongside it (any filename). Only one draft's worth of material sits in a team's drafts folder at a time — every image found there when converting belongs to that post. Both the `.md` and its images are deleted from `drafts/` once the real page is published; the published page is the permanent copy, not this folder.

## Output contract

1. Start from `blog/template.html` in this directory, unchanged except:
   - Fill in `ARTICLE_TITLE_HERE` (both in `<title>` and the `<h1 class="article-title">`), `ARTICLE_SUBTITLE_HERE` (meta description), `ARTICLE_TEAM_HERE` (`Axiom` or `Vertex`), and `ARTICLE_META_HERE` (keep it short, a date, or leave the div empty if there's nothing to put there).
   - Delete everything between `<!-- ARTICLE CONTENT START -->` and `<!-- ARTICLE CONTENT END -->` and replace it with the converted article body, inside the same `<div class="article-body">...</div>` wrapper.
2. Do not touch the nav, footer, `<style>` block, or any class name. The template's CSS already styles every tag you need (`h2`, `h3`, `p`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `img`, `a`, `strong`, `em`, `hr`). Do not add new classes or inline styles, do not introduce a markdown-rendering library.
3. Markdown -> HTML mapping: `#`/`##` headings become `<h2>` (the page's own `<h1>` is already the post title, so shift everything down one level), `###` becomes `<h3>`, fenced code blocks become `<pre><code>`, inline code becomes `<code>`, images become plain `<img src="..." alt="...">`, links become `<a href="...">`.
4. Save the result to `blog/<team>/<NNN>-<slug>.html`, lower-case, hyphenated, matching the post's number from the private drafts repo (e.g. `blog/axiom/001-hello-axiom.html`, `blog/vertex/002-....html`). Create the `axiom/` or `vertex/` subfolder if it doesn't exist yet.
5. Images go in a folder named exactly like the HTML file (no `.html`), sitting next to it: `blog/<team>/<NNN>-<slug>/<image-name>.<ext>`. Reference from the HTML with a plain relative path and no `../`, e.g. `<img src="001-hello-axiom/diagram.png">`. Image filenames inside that folder can be anything short and descriptive (kebab-case); they don't need to match whatever name the draft image arrived with.

## After the HTML file exists

Open `../posts_data.js` and find (or add) that post's entry in `LATEST_POSTS`, then set its `localUrl` field to the path from step 4, e.g.:

```js
{ title: 'We Build Automated Trading Systems', subtitle: '...',
  platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/001-hello-axiom.html',
  url: 'https://neomatrixai.substack.com/p/...', date: '2026-09-14' }
```

Once `localUrl` is set, the `/blog` section on `index.html` links straight to this local page instead of Substack. `example: true` can be dropped once the post is real, whether or not it's also gone out on Substack yet.

## Archive pages

`index.html`'s `/blog` section only shows the latest 5 posts per team. `blog/axiom/index.html` and `blog/vertex/index.html` list every post for that team, newest first, with a "More from Axiom / Vertex →" link on the homepage pointing to each. Both read `posts_data.js` directly at load time, so adding a new post's `localUrl` there is the only step needed — nothing in these two files needs to change per post.

## Why HTML and not raw markdown

The site has no markdown-rendering library anywhere (checked, none exists). Handing over finished HTML means no runtime parsing risk and full control over how each post looks, at the cost of doing the conversion once per post instead of writing a generic renderer.
