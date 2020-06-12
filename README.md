# EU LOTL Proxy

A simple serverless function that is called periodically to download and save [EU LOTL](https://ec.europa.eu/tools/lotl/eu-lotl.xml) so we can distribute it on our own from one place. In production, fetch endpoint is available via CDN. These files are not modified in any way and original signatures are therefore still there and can be verified (therefore it doesn't matter where this list comes from).

Reasons why this proxy was created:

1. Response time can vary a lot.
2. From time to time, some of the lists would time out or would not be available at all.

By keeping a copy of the lists, we can distribute them using our own CDN. Therefore, we can be pretty sure the user will be able to get any of them reliably and predictably fast.
