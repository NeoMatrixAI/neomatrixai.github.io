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
    // 002, ...), not by within-day timestamp. Each article's sidebar list
    // numbers posts by this same array order, so the number is the post number.
    { title: 'Nobody Approves These Trades',
      subtitle: 'Forty-five minutes of orders nobody approved cost Knight Capital more than $460 million. We run one where nobody approves orders either.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/001-nobody-approves-these-trades.html',
      thumb: 'blog/axiom/001-nobody-approves-these-trades/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/nobody-approves-these-trades?r=8y6w3o', date: '2026-09-23' },
    { title: 'The Text File That Ran Real Money',
      subtitle: 'Netflix built a tool to kill its own servers at random, so nothing could depend on one. Our old trading engine passed real orders through a text file.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/002-the-text-file-that-ran-real-money.html',
      thumb: 'blog/axiom/002-the-text-file-that-ran-real-money/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/the-text-file-that-ran-real-money?r=8y6w3o', date: '2026-09-23' },
    { title: 'One Number. Dozens of Strategies.',
      subtitle: 'Many strategies share one exchange account, and the exchange sees one net position per coin. Compositor writes down whose share is whose before each order.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/003-one-number-dozens-of-strategies.html',
      thumb: 'blog/axiom/003-one-number-dozens-of-strategies/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/one-number-dozens-of-strategies?r=8y6w3o', date: '2026-09-30' },
    { title: 'You Think Placing a Trade Is One Step. It\'s Six.',
      subtitle: 'Both US sprint relays dropped the baton in Beijing in 2008. A trade in our system is a six-stage relay, and every failure in this post happened at a handoff.',
      platform: 'substack', team: 'axiom', localUrl: 'blog/axiom/004-you-think-placing-a-trade-is-one-step-its-six.html',
      thumb: 'blog/axiom/004-you-think-placing-a-trade-is-one-step-its-six/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/you-think-placing-a-trade-is-one?r=8y6w3o', date: '2026-10-14' },
    { title: 'Your Backtest Is Lying. Here’s How We Catch It.',
      subtitle: 'Vertex is NeoMatrix\'s alpha research team. This series shows how signals are reasoned out and built.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/001-your-backtest-is-lying.html',
      thumb: 'blog/vertex/001-your-backtest-is-lying/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/your-backtest-is-lying-heres-how?r=8y6w3o', date: '2026-09-23' },
    { title: 'Bitcoin Is Fractal. That’s Not the Edge You Think.',
      subtitle: 'A single roughness number hides the question that actually matters.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/002-bitcoin-is-fractal.html',
      thumb: 'blog/vertex/002-bitcoin-is-fractal/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/bitcoin-is-fractal-thats-not-the?r=8y6w3o', date: '2026-09-23' },
    { title: 'Four Alphas or Four Million: When Breadth Costs Capacity',
      subtitle: 'Breadth costs capacity when it demands speed, illiquidity or crowding.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/003-four-alphas-or-four-million.html',
      thumb: 'blog/vertex/003-four-alphas-or-four-million/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/four-alphas-or-four-million-when?r=8y6w3o', date: '2026-09-30' },
    { title: 'How Three Weak Signals Make One Strong Trade',
      subtitle: 'A crypto composite that trades only where three measurements agree.',
      platform: 'substack', team: 'vertex', localUrl: 'blog/vertex/004-how-three-weak-signals-make-one-strong-trade.html',
      thumb: 'blog/vertex/004-how-three-weak-signals-make-one-strong-trade/thumb.jpg',
      url: 'https://neomatrixai.substack.com/p/how-three-weak-signals-make-one-strong?r=8y6w3o', date: '2026-10-14' },
];
