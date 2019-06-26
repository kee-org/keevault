/* eslint-disable no-console */
/* eslint-disable no-var */
/* eslint-disable no-inner-declarations */
/* eslint-disable prefer-arrow-callback */
window.updateAvailableElement = null;
window.updateAvailableRenderer = null;
window.keeVaultServiceWorkerRegistration = null;

// TODO: Try to find a safe way to only do this if Capacitor device.getInfo says
// it's web platform. Will require doing this all async... which may fuck up everything?

if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data === 'updateAvailable') {
            showReloadPageUI();
        }
    });

    function createRefreshButton() {
        var button = document.createElement('button');
        button.classList.add('vault_action');
        button.textContent = 'Kee Vault update available. Click to update now.';
        return button;
    }

    function reportNewVersionReady(button) {
        // Can have a new service worker and new index.html at the same time so avoid duplication
        if (!window.updateAvailableElement) {
            window.updateAvailableElement = document.createElement('div');
            window.updateAvailableElement.classList.add('vault_update_available');
            window.updateAvailableElement.appendChild(button);
        }
        if (window.updateAvailableRenderer) {
            window.updateAvailableRenderer(window.updateAvailableElement);
        }
    }

    function showReloadPageUI() {
        console.log('New page found');
        const button = createRefreshButton();
        button.addEventListener('click', function () {
            console.log('Reloading to get the new page');
            button.disabled = true;
            if (window.keeVaultServiceWorkerRegistration && window.keeVaultServiceWorkerRegistration.waiting) {
                window.keeVaultServiceWorkerRegistration.waiting.postMessage('skipWaiting'); // results in controllerchange event firing, hence reload
            } else {
                window.location.reload();
            }
        });
        reportNewVersionReady(button);
    };

    function showReloadServiceWorkerUI(registration) {
        console.log('New ServiceWorker found');
        const button = createRefreshButton();
        button.addEventListener('click', function () {
            if (!registration.waiting) {
                // Just to ensure registration.waiting is available before
                // calling postMessage()
                return;
            }
            console.log('Reloading to get new ServiceWorker');
            button.disabled = true;
            registration.waiting.postMessage('skipWaiting'); // results in controllerchange event firing, hence reload
        });
        reportNewVersionReady(button);
    };

    function onNewServiceWorker(registration, callback) {
        window.keeVaultServiceWorkerRegistration = registration;
        if (registration.waiting) {
            // SW is waiting to activate. Can occur if multiple clients open and
            // one of the clients is refreshed.
            return callback();
        }

        function listenInstalledStateChange() {
            registration.installing.addEventListener('statechange', function (event) {
                if (event.target.state === 'installed') {
                    // A new service worker is available, inform the user
                    callback();
                }
            });
        };

        if (registration.installing) {
            return listenInstalledStateChange();
        }

        // We are currently controlled so a new SW may be found...
        // Add a listener in case a new SW is found,
        registration.addEventListener('updatefound', listenInstalledStateChange);
    }

    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js')
            .then(function (registration) {
            // Check for updates every 8 hours. Local and remote caching will influence the
            // speed of update detection but this should get updates to most users within 32 hours.
            // TODO: Set to 8 hours once tested at faster pace.
                setInterval(() => {
                    console.log(registration);
                    registration.update();
                }, 0.5 * 3600000);

                // Track updates to the Service Worker.
                if (!navigator.serviceWorker.controller) {
                // The window client isn't currently controlled so it's a new service
                // worker that will activate immediately
                    return;
                }

                // When the user asks to refresh the UI, we'll need to reload the window
                var preventDevToolsReloadLoop;
                navigator.serviceWorker.addEventListener('controllerchange', function (event) {
                // Ensure refresh is only called once.
                // This works around a bug in "force update on reload".
                    if (preventDevToolsReloadLoop) return;
                    preventDevToolsReloadLoop = true;
                    console.log('Controller loaded');
                    window.location.reload();
                });

                onNewServiceWorker(registration, function () {
                    showReloadServiceWorkerUI(registration);
                });
            })
            .catch(function (reason) {
                console.error('Error loading service worker: ' + reason);
            });
    });
} else {
    // Private browsing mode or an old browser. Probably only Firefox ESR supports all
    // other required features but not service workers.
    var warningMsg = document.createElement('span');
    warningMsg.innerText = 'Offline access is not available on this device. This is expected when in private browsing mode. If you use Firefox 60 ESR you will need to manually enable "Service workers" to enable offline support.';
    window.updateAvailableElement = document.createElement('div');
    window.updateAvailableElement.classList.add('vault_update_available');
    window.updateAvailableElement.appendChild(warningMsg);
    if (window.updateAvailableRenderer) {
        window.updateAvailableRenderer(window.updateAvailableElement);
    }
}
