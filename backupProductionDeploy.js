/* eslint-disable no-console */

// NOT IN USE
// Ideally we would use this but MS have a combination of bugs on Azure that
// make hosting a root domain securely impossible so until they fix that, this file is useless.

const {
    AnonymousCredential,
    uploadFileToBlockBlob,
    Aborter,
    BlobURL,
    BlockBlobURL,
    ContainerURL,
    ServiceURL,
    StorageURL
  } = require('@azure/storage-blob');
const fs = require('fs');
const {join} = require('path');
const mime = require('mime-types');

const args = process.argv.slice(2);

const isDirectory = path => fs.statSync(path).isDirectory();
const getDirectories = path =>
    fs.readdirSync(path).map(name => join(path, name)).filter(isDirectory);

const isFile = path => fs.statSync(path).isFile();
const getFiles = path =>
    fs.readdirSync(path).map(name => join(path, name)).filter(isFile);

const getFilesRecursively = (path) => {
    const dirs = getDirectories(path);
    const files = dirs
        .map(dir => getFilesRecursively(dir))
        .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten
    return files.concat(getFiles(path));
};

const inferContentType = (filename) => mime.lookup(filename) || 'application/octet-stream';

async function main() {
    if (!args || args.length < 1) {
        throw new Error('Missing args');
    }
    const account = args[0];
    const accountSas = args.length > 1 ? args[1] : process.env['AZURE_SAS'];

    console.log(accountSas);

    if (!accountSas) {
        throw new Error('Missing SAS');
    }

    const pipeline = StorageURL.newPipeline(new AnonymousCredential(), {
        retryOptions: { maxTries: 4 }, // Retry options
        telemetry: { value: 'KeeVault.pm CD' } // Customized telemetry string
    });

    const serviceURL = new ServiceURL(
        `https://${account}.blob.core.windows.net${accountSas}`,
        pipeline
    );

    const containerName = `$web`;
    const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName);

    const uploads = [];
    const files = getFilesRecursively('dist').concat(getFilesRecursively('static'));
    for (const localFile of files) {
        const remoteFile = localFile.substring(localFile.indexOf('/') + 1);
        const contentType = inferContentType(localFile);
        const blobURL = BlobURL.fromContainerURL(containerURL, remoteFile);
        const blockBlobURL = BlockBlobURL.fromBlobURL(blobURL);
        uploads.push(uploadFileToBlockBlob(Aborter.none, localFile, blockBlobURL, {
            blockSize: 4 * 1024 * 1024, // 4MB
            parallelism: 10,
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        }));
    }

    await Promise.all(uploads);
}

main()
    .then(() => {
        console.log('All uploaded.');
    })
    .catch(err => {
        process.exitCode = 1;
        console.error(err.message);
    });
