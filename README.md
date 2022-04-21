# Kee Vault 1

Kee Vault version 1 is a password manager for your web browser. Password databases (Vaults) are encrypted using the KeePass storage format before being sent to a remote server for synchronisation purposes.

This is the bulk of the user-visible part of Kee Vault web app, based on a heavily modified fork of KeeWeb. To see the complete picture of what source code executes in the browser (and hence verify that sensitive data is protected) you'll need to look at some of the npm dependencies too:

* kee-frontend: Offers a simplified API for interacting with the hosted Kee Vault service.
* kdbx-placeholders: Enables support for KeePass placeholders.
* kprpc: A KeePassRPC server for the KeePassRPC client within the Kee browser extension to connect to.

Obviously all npm dependencies in the project impact upon the behaviour of the app but we highlight those above since they are the ones authored by the Kee Vault team and hence would be the place to find any funny business on our part.

# Kee Vault 2

Kee Vault version 2 is available in a [separate code repository](https://github.com/kee-org/keevault2). Both versions are compatible with the Kee Vault hosted services. In most cases, you'll need to tweak the v1 code to point to the production hosted services because the dev hosted services are not able to email out account verification links, etc. but for v2 you can just work with the free user account in almost all situations.

From a technical perspective the major difference is that this repository is a Javascript web app and version 2 is a Flutter app, initially available only on Android devices. For a broader view of the feature and benefit differences, check out the Kee website: https://www.kee.pm/features/ 

# Client support

We aim for the project to be compatible with all browsers released in 2018 or later. Most modern browsers and devices will have already automatically updated to versions that support Kee Vault and many browsers from 2017 or earlier will also work, although we make no effort to validate this.

In future we may further increase the requirement to even newer browsers if we decide that failing to do so will put users of older browsers at a significantly increased risk. However, we'll try to introduce most features in a way that gracefully degrades the experience for users that are stuck on the "current modern".

# Initial build prep per machine

```
npm install
mkdir cert
openssl req \
    -newkey rsa:2048 \
    -x509 \
    -nodes \
    -keyout cert/server.key \
    -new \
    -out cert/server.crt \
    -subj /CN=app-dev.kee.pm \
    -reqexts SAN \
    -extensions SAN \
    -config <(cat /usr/lib/ssl/openssl.cnf \
        <(printf '[SAN]\nsubjectAltName=DNS:app-dev.kee.pm')) \
    -sha256 \
    -days 3650
```

# Build and run dev server

```
npm start
```

# License

[AGPL3 with permitted extra clauses](https://github.com/kee-org/keevault/blob/master/LICENSE)
