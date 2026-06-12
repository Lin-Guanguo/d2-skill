import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { URL } from 'node:url';
import selfsigned from 'selfsigned';

interface CallbackServerOptions {
  expectedState: string;
  redirectUri: string;
  timeoutSeconds: number;
}

function makeCallbackHtml(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem; line-height: 1.5; }
      code { background: #f2f2f2; padding: 0.125rem 0.25rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>${body}</p>
  </body>
</html>`;
}

function makeSelfSignedCertificate(hostname: string) {
  const pems = selfsigned.generate(
    [
      { name: 'commonName', value: hostname },
      { name: 'organizationName', value: 'd2-skill local OAuth' },
    ],
    {
      days: 1,
      keySize: 2048,
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: hostname === '127.0.0.1' ? 7 : 2,
              value: hostname,
            },
          ],
        },
      ],
    },
  );
  return {
    key: pems.private,
    cert: pems.cert,
  };
}

export async function waitForAuthorizationCode({
  expectedState,
  redirectUri,
  timeoutSeconds,
}: CallbackServerOptions) {
  const redirect = new URL(redirectUri);
  const hostname = redirect.hostname;
  const port = Number.parseInt(redirect.port, 10);
  const callbackPath = redirect.pathname;

  if (!['http:', 'https:'].includes(redirect.protocol)) {
    throw new Error('OAUTH_REDIRECT_URI must use http:// or https://');
  }

  if (!port) {
    throw new Error('OAUTH_REDIRECT_URI must include an explicit localhost port');
  }

  if (!['127.0.0.1', 'localhost'].includes(hostname)) {
    throw new Error('OAUTH_REDIRECT_URI must use 127.0.0.1 or localhost for local CLI login');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      server.close();
      callback();
    };

    const timeout = setTimeout(() => {
      finish(() =>
        reject(new Error(`Timed out waiting for OAuth callback after ${timeoutSeconds}s`)),
      );
    }, timeoutSeconds * 1000);

    const handler = (request: IncomingMessage, response: ServerResponse) => {
      const requestUrl = new URL(request.url ?? '/', redirectUri);
      if (requestUrl.pathname !== callbackPath) {
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          makeCallbackHtml('Not found', 'This is not the configured OAuth callback path.'),
        );
        return;
      }

      const error = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');

      if (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          makeCallbackHtml('Authorization failed', `Bungie returned <code>${error}</code>.`),
        );
        finish(() => reject(new Error(`Bungie authorization failed: ${error}`)));
        return;
      }

      if (!code || !state) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          makeCallbackHtml('Invalid callback', 'The callback did not include code and state.'),
        );
        return;
      }

      if (state !== expectedState) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          makeCallbackHtml('Invalid state', 'OAuth state did not match. You can close this tab.'),
        );
        finish(() => reject(new Error('OAuth state did not match')));
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        makeCallbackHtml(
          'Authorization complete',
          'You can close this tab and return to the terminal.',
        ),
      );
      finish(() => resolve(code));
    };

    const server =
      redirect.protocol === 'https:'
        ? createHttpsServer(makeSelfSignedCertificate(hostname), handler)
        : createHttpServer(handler);

    server.on('error', (error) => {
      finish(() => reject(error));
    });

    server.listen(port, hostname);
  });
}
