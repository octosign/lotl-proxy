const fetch = require('node-fetch');
const AWS = require('aws-sdk');
const parser = require('fast-xml-parser');
const crypto = require('crypto');
const mime = require('mime-types');

const s3 = new AWS.S3();

const LOTL_URL = 'https://ec.europa.eu/tools/lotl/eu-lotl.xml';

module.exports.refresh = async (event, context, callback) => {
    const startTime = Date.now();

    const response = await fetch(LOTL_URL);
    if (response.status !== 200) {
        callback(null, {
            statusCode: 500,
            body: 'Unable to fetch the LOTL.',
        });
        return;
    }

    const lotlResponse = await response.text();

    if(parser.validate(lotlResponse) !== true) {
        throw new Error('LOTL XML is not valid');
    }

    const lotl = parser.parse(lotlResponse);

    const saveUrl = async url => {
        let response;
        try {
            response = await fetch(url);
        } catch (e) {
            console.warn(`Skipping "${url}" due to error "${e}".`);
            return;
        }
        if (response.status !== 200) {
            console.warn(`Skipping "${url}" due to HTTP status code "${response.status}".`);
            return;
        }
        const content = await response.text();
        if (content.length === 0) {
            console.warn(`Skipping "${url}" because it is empty.`);
            return;
        }

        const sha1sum = crypto.createHash('sha1');
        sha1sum.update(url);
        const digest = sha1sum.digest('hex');

        await (s3.putObject({
            Bucket: process.env.BUCKET,
            Key: digest,
            Body: content,
        }).promise());
    };

    // LOTL itself and its scheme information pivot
    await saveUrl(LOTL_URL);
    const pivotUrl = lotl.TrustServiceStatusList.SchemeInformation.SchemeInformationURI.URI.find((uri) => uri.includes('pivot'));
    pivotUrl && await saveUrl(pivotUrl);

    // Lists of lists
    const list = lotl.TrustServiceStatusList.SchemeInformation.PointersToOtherTSL.OtherTSLPointer;
    await Promise.all(list.map(location => saveUrl(location.TSLLocation)));

    console.log(`OK - update took ${Date.now() - startTime}ms.`);
    return;
}

module.exports.fetch = async (event, context, callback) => {
    if (!event.queryStringParameters || !event.queryStringParameters.url) {
        callback(null, {
            statusCode: 400,
            body: 'Missing url param.',
        });
        return;
    }

    const sha1sum = crypto.createHash('sha1');
    sha1sum.update(event.queryStringParameters.url);
    const digest = sha1sum.digest('hex');

    const data = await (s3.getObject({
        Bucket: process.env.BUCKET,
        Key: digest,
    }).promise());

    const mimeType = mime.lookup(event.queryStringParameters.url) || 'application/octet-stream';

    callback(null, {
        statusCode: 200,
        headers: {
            'content-type': mimeType,
        },
        body: data.Body.toString('utf-8'),
    });
    return;
};
