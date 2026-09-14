// posts_data.js: the running list of published blog posts. The landing
// page's /blog section has top-level tabs for the platform (X, Substack),
// and Substack has its own inner tabs for its two sections, Axiom and
// Vertex. Every tab/sub-tab lists newest-first. Add one entry here each
// time a real post goes live (Substack article or X post); no cap on how
// many can exist per tab.
//
// Schema per entry:
//   title    : the post's real title, verbatim (string)
//   platform : 'substack' | 'x'
//   team     : 'axiom' | 'vertex', required for a Substack post (it decides
//              which Substack sub-tab it lands in); omit for an X post.
//   url      : the REAL, live, public URL, never a placeholder or draft link
//   date     : 'YYYY-MM-DD', the actual publish date
//
// Teams, for reference: Axiom = trading systems & infrastructure team,
// Vertex = quantitative alpha research team.
const LATEST_POSTS = [
    // Axiom (trading systems / infrastructure team)
    { title: 'We Build Automated Trading Systems', platform: 'substack', team: 'axiom',
      url: 'https://neomatrixai.substack.com/p/6c2cff7d-ba70-43d0-b27d-09eff8fd2ae3', date: '2026-09-14' },
    { title: 'LiveSys v02: Rebuilding Live Trading on Kubernetes', platform: 'substack', team: 'axiom',
      url: 'https://neomatrixai.substack.com/p/a9b71ef8-1d2f-4aa7-a159-91257f59f6d8', date: '2026-09-14' },
    // Vertex (quantitative alpha research team)
    { title: 'Vertex Builds Trading Signals', platform: 'substack', team: 'vertex',
      url: 'https://neomatrixai.substack.com/p/42a97c7d-3fb3-4f55-a95e-c4a1d683e359', date: '2026-09-14' },
    { title: 'Spectrum Width: What One Exponent Misses', platform: 'substack', team: 'vertex',
      url: 'https://neomatrixai.substack.com/p/b96fe760-1236-4fbc-a140-7ff3a73aa17e', date: '2026-09-14' },
];
