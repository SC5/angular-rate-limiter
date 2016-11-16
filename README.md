# angular-rate-limiter

Simple rate limiting service for the Angular $http requests. It uses token bucket for limiting request interval to the server.
You can configure multiple token buckets with different rules to match an HTTP request.

## Usage

Basic usage in your application:
```js
angular.module('myApp', ['angularRateLimiter'])
    .config(function(AngularRateLimiterProvider) {
        // 10 request per second for requests to servers
        AngularRateLimiterProvider.addRateLimiter({
            bucketSize: 10,        // Maximum number of tokens bucket can hold
            tokensPerInterval: 1,  // Add 1 token per interval
            tokenInterval: 100     // Add tokens every 100ms
        });

        // Enable limiters
        AngularRateLimiterProvider.enableLimiters();
    });
```

Use rate limiting to specific URL:
```js
angular.module('myApp', ['angularRateLimiter'])
    .config(function(AngularRateLimiterProvider) {
        // 10 request per second for requests to servers.
        AngularRateLimiterProvider.addRateLimiter({
            match: 'api.mydomain.com',  // Only use limiting on request which URL contain 'api.mydomain.com'
            bucketSize: 10,             // Maximum number of tokens bucket can hold
            tokensPerInterval: 10,      // Add 10 token per interval
            tokenInterval: 1000,        // Add tokens every 1s
            retryDelay: -1              // Do not retry request when HTTP code 429 is received
        });

        // Enable limiters
        AngularRateLimiterProvider.enableLimiters();
    });
```