// posts_data.js: the running list of blog posts. The landing page's /blog
// section has top-level tabs for the platform (X, Substack); Substack shows
// Axiom and Vertex side by side. Every list is newest-first, title only, no
// date shown. Add one entry here each time a real post goes live (Substack
// article or X post); no cap on how many entries can exist per team in this
// array, but index.html's renderTeam() only shows the latest 5 per team as
// large image cards (see its .slice(0, 5)) so the homepage doesn't grow
// unbounded — older ones still exist here, just not shown there.
//
// Schema per entry:
//   title    : the post's real title, verbatim (string)
//   subtitle : optional, one line, shown under the title on the landing
//              page. Leave it off a post with no real subtitle yet, it
//              just renders without one, never invent one.
//   platform : 'substack' | 'x'
//   team     : 'axiom' | 'vertex', required for a Substack post; omit for X.
//   url      : the REAL, live, public URL, never a placeholder or draft link
//   date     : 'YYYY-MM-DD', the actual publish date (used for sort order only)
//   example  : true while `url` is still a Substack draft link (not public
//              yet). The title links to the team's Substack page instead of
//              the draft URL. Remove this field (or set to false) the
//              moment the post actually goes live on Substack.
//   localUrl : optional, e.g. 'blog/axiom/001-hello-axiom.html'. Set once a
//              real article page exists on this site (see blog/README.md
//              for how those pages get made). When present, any page that
//              renders this list links here instead of Substack, `example`
//              or not — this always wins over the Substack fallback.
//   placeholder : true for a slot with no real next post yet. Renders a
//              generic "more coming" title/thumbnail instead of a specific
//              unpublished title, so the landing page never implies a
//              particular article exists before it does. Remove this field
//              (and fill in the real title/subtitle) once a real draft for
//              that slot exists.
//   thumb    : optional, e.g. 'blog/axiom/001-hello-axiom/diagram.png'. The
//              actual image shown in the landing-page card's thumbnail box.
//              Leave it off and the card falls back to a plain team-initial
//              monogram (never invent a thumb path that doesn't exist).
//
// Teams, for reference: Axiom = trading systems & infrastructure team,
// Vertex = quantitative alpha research team.
const LATEST_POSTS = [
    // Axiom (trading systems / infrastructure team), not yet published, draft links only
    { title: 'Next From Axiom', subtitle: 'A new Axiom post is coming soon.',
      platform: 'substack', team: 'axiom', example: true, localUrl: 'blog/axiom/001-we-build-automated-trading-systems.html',
      thumb: 'blog/axiom/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/6c2cff7d-ba70-43d0-b27d-09eff8fd2ae3', date: '2026-09-14' },
    { title: 'More From Axiom', subtitle: 'Another new post is coming soon.',
      platform: 'substack', team: 'axiom', example: true, localUrl: 'blog/axiom/002-example-post.html',
      thumb: 'blog/axiom/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/a9b71ef8-1d2f-4aa7-a159-91257f59f6d8', date: '2026-09-13' },
    { title: 'Even More From Axiom', subtitle: 'Coming soon.',
      platform: 'substack', team: 'axiom', example: true, localUrl: 'blog/axiom/003-another-example-post.html',
      thumb: 'blog/axiom/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/a9b71ef8-1d2f-4aa7-a159-91257f59f6d8', date: '2026-09-12' },
    // Vertex (quantitative alpha research team), not yet published, draft links only
    { title: 'Next From Vertex', subtitle: 'A new Vertex post is coming soon.',
      platform: 'substack', team: 'vertex', example: true, localUrl: 'blog/vertex/001-vertex-builds-trading-signals.html',
      thumb: 'blog/vertex/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/42a97c7d-3fb3-4f55-a95e-c4a1d683e359', date: '2026-09-14' },
    { title: 'More From Vertex', subtitle: 'Another new post is coming soon.',
      platform: 'substack', team: 'vertex', example: true, localUrl: 'blog/vertex/002-example-post.html',
      thumb: 'blog/vertex/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/b96fe760-1236-4fbc-a140-7ff3a73aa17e', date: '2026-09-13' },
    { title: 'Even More From Vertex', subtitle: 'Coming soon.',
      platform: 'substack', team: 'vertex', example: true, localUrl: 'blog/vertex/003-another-example-post.html',
      thumb: 'blog/vertex/example-thumb.svg',
      url: 'https://neomatrixai.substack.com/p/b96fe760-1236-4fbc-a140-7ff3a73aa17e', date: '2026-09-12' },
];
