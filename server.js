const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'bjpack <onboarding@resend.dev>';
const ROOT = __dirname;

const products = new Set([
  'astro-antfustyle', 'business-starter', 'cryptoflow', 'ecommerce', 'fyrre-magazine',
  'holo-theme', 'landing-page', 'magic-portfolio', 'nuno',
  'paddle-mobile-web-payments-starter', 'portfolio', 'saas-boilerplate',
  'shadcn-ui', 'shadcn-admin', 'solitude'
]);

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(type ? body : JSON.stringify(body));
}

function emailHtml(title) {
  return '<!doctype html><html><body style="margin:0;background:#f4f2ed;color:#171719;font-family:Arial,sans-serif"><div style="max-width:600px;margin:32px auto;background:#fff;padding:40px"><p style="color:#b47b16;letter-spacing:3px;font-size:12px;font-weight:bold">BJPACK</p><h1 style="font-size:28px;margin:28px 0 16px">Thank you for your purchase.</h1><p style="font-size:16px;line-height:1.6">Your <strong>' + title + '</strong> source files are attached to this email as a ZIP archive.</p><p style="font-size:16px;line-height:1.6">Download the archive, extract it, and follow the included documentation to get started.</p><p style="font-size:14px;color:#666;line-height:1.6;margin-top:32px">If you need help, reply to this email or contact support@example.com.</p><hr style="border:0;border-top:1px solid #e5e2db;margin:32px 0"><p style="font-size:12px;color:#888">bjpack — production-ready website templates.</p></div></body></html>';
}

async function purchase(req, res) {
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 10000) req.destroy(); });
  req.on('end', async () => {
    try {
      const data = JSON.parse(raw || '{}');
      const email = String(data.email || '').trim();
      const id = String(data.productId || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !products.has(id)) return send(res, 400, { error: 'Please provide a valid email and product.' });
      if (!RESEND_API_KEY) return send(res, 503, { error: 'Email delivery is not configured yet.' });
      const productFile = path.join(ROOT, 'projects-code', 'downloads', id + '.zip');
      if (!fs.existsSync(productFile)) return send(res, 404, { error: 'The requested download is unavailable.' });
      const attachment = fs.readFileSync(productFile).toString('base64');
      const title = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: RESEND_FROM, to: [email], subject: 'Your bjpack template is ready — ' + title, html: emailHtml(title), attachments: [{ filename: id + '.zip', content: attachment }] }) });
      if (!response.ok) return send(res, 502, { error: 'We could not send the email. Please try again.' });
      send(res, 200, { ok: true });
    } catch (error) { send(res, 500, { error: 'Something went wrong. Please try again.' }); }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/purchase') return purchase(req, res);
  const route = req.url.split('?')[0];
  const prettyRoutes = { '/': '/index.html', '/home': '/index.html', '/templates': '/index.html', '/privacy': '/privacy.html', '/terms': '/terms.html', '/refunds': '/refunds.html' };
  const productRoute = route.match(/^\/product\/([a-z0-9-]+)$/);
  const requested = productRoute ? '/product.html' : (prettyRoutes[route] || route);
  const file = path.resolve(ROOT, '.' + requested);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
  send(res, 200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
});
server.listen(PORT, () => console.log('bjpack server running on http://localhost:' + PORT));
