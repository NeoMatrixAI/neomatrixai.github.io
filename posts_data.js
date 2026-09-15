// posts_data.js: the running list of blog posts. The landing page's /blog
// section has top-level tabs for the platform (X, Substack); Substack shows
// Axiom and Vertex side by side. Every list is newest-first, title only, no
// date shown. Add one entry here each time a real post goes live (Substack
// article or X post); no cap on how many can exist per team.
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
//
// Teams, for reference: Axiom = trading systems & infrastructure team,
// Vertex = quantitative alpha research team.
const LATEST_POSTS = [
    // Axiom (trading systems / infrastructure team), not yet published, draft links only
    { title: 'We Build Automated Trading Systems', subtitle: 'Full post publishing soon on Substack.',
      platform: 'substack', team: 'axiom', example: true,
      url: 'https://neomatrixai.substack.com/p/6c2cff7d-ba70-43d0-b27d-09eff8fd2ae3', date: '2026-09-14' },
    { title: 'LiveSys v02: Rebuilding Live Trading on Kubernetes', subtitle: 'Full post publishing soon on Substack.',
      platform: 'substack', team: 'axiom', example: true,
      url: 'https://neomatrixai.substack.com/p/a9b71ef8-1d2f-4aa7-a159-91257f59f6d8', date: '2026-09-14' },
    // Vertex (quantitative alpha research team), not yet published, draft links only
    { title: 'Vertex Builds Trading Signals', subtitle: 'Full post publishing soon on Substack.',
      platform: 'substack', team: 'vertex', example: true,
      url: 'https://neomatrixai.substack.com/p/42a97c7d-3fb3-4f55-a95e-c4a1d683e359', date: '2026-09-14' },
    { title: 'Spectrum Width: What One Exponent Misses', subtitle: 'Full post publishing soon on Substack.',
      platform: 'substack', team: 'vertex', example: true,
      url: 'https://neomatrixai.substack.com/p/b96fe760-1236-4fbc-a140-7ff3a73aa17e', date: '2026-09-14' },
];
