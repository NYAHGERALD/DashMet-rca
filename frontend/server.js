const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// SSL certificates
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+3-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+3.pem')),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`🔒 HTTPS Server ready on https://${hostname}:${port}`);
      console.log(`   Access from mobile: https://192.168.1.217:${port}`);
    });
});
