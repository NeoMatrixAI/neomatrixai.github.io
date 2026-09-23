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
    // Posts sharing a date keep this array's order (the sort is stable), so
    // within one team, entries go in the actual draft/publish order (001,
    // 002, ...), not by within-day timestamp.
    { title: 'Nobody Approves These Trades',
      subtitle: 'We\'re Axiom, NeoMatrix\'s trading systems team. Here\'s what it takes to build and run one.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/001-nobody-approves-these-trades.html',
      thumb: 'blog/axiom/001-nobody-approves-these-trades/thumb.png',
      url: 'https://neomatrixai.substack.com/p/nobody-approves-these-trades', date: '2026-09-23' },
    { title: 'The Text File That Ran Real Money',
      subtitle: 'Real money moved through three OS processes talking over a text file. Here\'s why we rebuilt it on Kubernetes.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/002-the-text-file-that-ran-real-money.html',
      thumb: 'blog/axiom/002-the-text-file-that-ran-real-money/thumb.png',
      url: 'https://neomatrixai.substack.com/p/the-text-file-that-ran-real-money', date: '2026-09-23' },
    { title: 'Your Backtest Is Lying. Here’s How We Catch It.',
      subtitle: 'Vertex is NeoMatrix\'s alpha research team. This series shows how signals are reasoned out and built.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/001-your-backtest-is-lying.html',
      thumb: 'blog/vertex/001-your-backtest-is-lying/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/your-backtest-is-lying-heres-how', date: '2026-09-23' },
    { title: 'Bitcoin Is Fractal. That’s Not the Edge You Think.',
      subtitle: 'A single roughness number hides the question that actually matters.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/002-bitcoin-is-fractal.html',
      thumb: 'blog/vertex/002-bitcoin-is-fractal/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/bitcoin-is-fractal-thats-not-the', date: '2026-09-23' },
];
