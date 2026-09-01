/**
 * Dynamic robots.txt — blocks crawlers pre-launch, allows indexing when SAYMD_PUBLIC=1.
 */
export default function handler(_req, res) {
  const isPublic = process.env.SAYMD_PUBLIC === '1';
  const lines = isPublic
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        'Disallow: /api/',
        'Disallow: /coming-soon.html',
        '',
        'Sitemap: https://saymd.app/sitemap.xml',
      ]
    : ['User-agent: *', 'Disallow: /', '', 'Sitemap: https://saymd.app/sitemap.xml'];

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(lines.join('\n') + '\n');
}
