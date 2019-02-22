const cacheName = 'kee-static-cache';

const cacheFiles = [
    '/',
    '/icons/android-chrome-192x192.png',
    '/icons/android-chrome-512x512.png',
    '/icons/apple-touch-icon.png',
    '/icons/favicon-16x16.png',
    '/icons/favicon-32x32.png',
    '/icons/mstile-150x150.png',
    '/icons/mstile-310x150.png',
    '/icons/mstile-310x310.png',
    '/icons/safari-pinned-tab.svg',
    '/icons/favicon.ico'
];

function stripFragment(urlString) {
    const url = new URL(urlString);
    url.hash = '';
    return url.toString();
}

self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(cacheName).then((cache) => {
          return cache.addAll(cacheFiles);
      })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [cacheName];

    event.waitUntil(
      caches.keys().then((cacheNames) => {
          return Promise.all(
          cacheNames.map((cacheName) => {
              if (cacheWhitelist.indexOf(cacheName) === -1) {
                  return caches.delete(cacheName);
              }
          })
        );
      })
    );
});

// On fetch, use cache but update the entry with the latest contents
// from the server.
self.addEventListener('fetch', (evt) => {
    // Only handle our static files
    if (!cacheFiles.some(file => location.origin + file === stripFragment(evt.request.url))) {
        return evt.request;
    }

    evt.respondWith((async () => {
        // if there's a pending update to the serviceworker, switch to that version on navigate/refresh
        // linting errors due to lack of linter support for serviceworker global scope. E.g.:
        // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/registration
        if (evt.request.mode === 'navigate' &&
            evt.request.method === 'GET' &&
            registration.waiting && //eslint-disable-line
            (await clients.matchAll()).length < 2 //eslint-disable-line
        ) {
            registration.waiting.postMessage('skipWaiting'); //eslint-disable-line
            return new Response('', {headers: {'Refresh': '0'}});
        }
        return fromCache(evt.request);
    })());

    // ...and `waitUntil()` to prevent the worker to be killed until
    // the cache is updated.
    evt.waitUntil(
        update(evt.request)
    );
});

function fromCache(request) {
    return caches.open(cacheName).then(async (cache) => {
        const response = await cache.match(request);
        if (stripFragment(request.url) === location.origin + '/') {
            latestMainPageEtag = response.headers.get('Etag');
            try {
                latestMainPageModifiedDate = new Date(response.headers.get('last-modified'));
            } catch (e) {}
        }
        return response;
    });
}

let latestMainPageEtag = '';
let latestMainPageModifiedDate = new Date();

  // Update consists in opening the cache, performing a network request and
  // storing the new response data.
function update(request) {
    // https://bugs.chromium.org/p/chromium/issues/detail?id=823392
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

    request.credentials = 'same-origin';

    return fetch(request).then((response) => {
        try {
            if (stripFragment(request.url) === location.origin + '/' &&
            ((response.headers.has('Etag') &&
            response.headers.get('Etag') !== latestMainPageEtag) ||
            (response.headers.has('last-modified') &&
            new Date(response.headers.get('last-modified')) > latestMainPageModifiedDate))) {
            // hack alert: At least during local dev, the fetch promise for '/'
            // can resolve before the earlier request to load from the SW cache
            // so this allows us to send the message to the app after it's
            // actually loaded. 2 seconds is a pretty arbitrary choice.
                setTimeout(() => {
                console.log("Sending update available message"); //eslint-disable-line
                    sendMessageToPage('updateAvailable');
                }, 2000);
            }
        } catch (e) {}
        if (response.type === 'opaque') {
            return response;
        } else if (!response.ok) {
        // don't cache it but let the main application handle any errors from the network
            return response;
        } else {
            return caches.open(cacheName).then((cache) => {
                cache.put(request, response.clone());
                return response;
            }).catch((error) => {
                console.error("Service worker error: " + error); //eslint-disable-line
                return response;
            });
        }
    });
}

self.addEventListener('message', (event) => {
    if (!event.data) {
        return;
    }

    switch (event.data) {
        case 'skipWaiting':
            self.skipWaiting();
            break;
        default:
      // NOOP
            break;
    }
});

function sendMessageToPage (msg) {
    // linting errors due to lack of linter support for serviceworker global scope.
    clients.matchAll().then(clients => { //eslint-disable-line
        clients.forEach(client => {
            client.postMessage(msg);
        });
    });
}
// Version: @@VERSION-@@COMMIT
