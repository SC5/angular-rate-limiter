/** 
 * @ngdoc overview 
 * @name angularRateLimiter
 * @description
 * Angular HTTP request rate limiter module.
 * 
 * @example
    <example module="angularRateLimiter">
        <file name="myApp.js">
            angular.module('myApp', ['angularRateLimiter'])
                .config(function(AngularRateLimiterProvider) {
                    // 10 request per second for requests to servers
                    AngularRateLimiterProvider.addRateLimiter({
                        match: 'api.mydomain.com', // Use limiter only request to `api.mydomain.com`
                        bucketSize: 10,        // Maximum number of tokens bucket can hold
                        tokensPerInterval: 1,  // Add 1 token per interval
                        tokenInterval: 100     // Add tokens every 100ms
                    });

                    // Wait for 100ms before trying to get token for request
                    angularRateLimterProvider.setRequestDelay(100);

                    // Wait for 100ms before retrying failed request, which returned HTTP code 429
                    angularRateLimterProvider.setRetryDelay(100);

                    // Enable limiters
                    angularRateLimterProvider.enableLimiters();
                });
        </file>
    </example>  
 */
(function(angular) {
    'use strict';

    // Check that angular is loaded
    if(!angular) {
        console.error('No angular.js loaded');
        return;
    }

    // Define angular module and dependancies
    var ngModule = angular.module('angularRateLimiter', []);


    /**
     * @ngdoc service
     * @name angularRateLimiter.AngularRateLimiterProvider
     * @description 
     * AngularRateLimiter provider to configure rate limiters for application.
     */
    ngModule.provider('AngularRateLimiter', function($httpProvider) {
        var isInterceptorConfigured = false;
        var rules = [];
        var requestDelay = 50;
        var retryInterval = 50;
        var defaultRuleConfiguration = {
            match: '',
            bucketSize: 20,
            tokensPerInterval: 20,
            tokenInterval: 1000
        };

        // Set provider methods
        this.addRateLimiter = addRateLimiter;
        this.setRequestDelay = setRequestDelay;
        this.setRetryDelay = setRetryDelay;
        this.enableLimiters = enableLimiters; 
        this.$get = angularRateLimiterFactory;


        /**
         * @ngdoc method
         * @name angularRateLimiter.AngularRateLimiterProvider#addRateLimiter
         * @methodOf angularRateLimiter.AngularRateLimiterProvider
         * @description
         * Add new rate limiter rule.
         * 
         * @param {Object|Array} option Rate limiter configuration object.
         *                  `match` property defined rule to match limiter
         *                  to request. If value is `String` or `RegExp`, then
         *                  request URL is match with the value using 
         *                  `String.match`. If `function` is given, then 
         *                  request object is passed to function and it should
         *                  return `Boolean` value does request match to rule.
         *                  `bucketSize` configures how many tokens bucket 
         *                  holds, default is 100.
         *                  `tokensPerInterval` configures how many tokens will
         *                  be added to bucket per interval
         *                  `tokenInterval` configures interval how often 
         *                  `tokensPerInterval` value will be added to bucket.
         * @throws {Error}   Error is thrown if rule cannot be added.
         */
        function addRateLimiter(option) {
            // If option is given as array of options, then add them one by one
            if(option instanceof Array) {
                for(var i in option) {
                    if(typeof option[i] === 'object') {
                        addRateLimiter(option[i]);
                    }
                }
                return;
            }

            var rule = angular.assign(defaultRuleConfiguration, option);

            if(!rule.match) {
                if(rules.length) {
                    throw new Error('Cannot add rate limiter that matches to all requests, when other rules are defined');
                }

                // Use debug console, if configuring match all rule.
                if(console && console.debug) {
                    console.debug('Adding match all rule');
                }
            }

            if(!rule.bucketSize) {
                throw new Error('No bucketSize configured for rate limiter');
            }

            if(rule.tokensPerInterval && isNaN(rule.tokensPerInterval)) {
                throw new Error('Invalid tokensPerInterval value');
            }

            if(rule.tokenInterval && isNaN(rule.tokenInterval)) {
                throw new Error('Invalid tokensPerInterval value');
            }

            rules.push(rule);
        }


        /**
         * @ngdoc method
         * @name angularRateLimiter.AngularRateLimiterProvider#setRequestDelay
         * @methodOf angularRateLimiter.AngularRateLimiterProvider
         * @description
         * Set request delay. Sets delay value, which will be used to retry to 
         * get token from bucket.
         * 
         * @param {Number} value Number of milliseconds to wait until retry to get token.
         */
        function setRequestDelay(value) {
            if(isNaN(value)) {
                throw new Error('Invalid value for request delay');
            }

            requestDelay = value;
        }


        /**
         * @ngdoc method
         * @name angularRateLimiter.AngularRateLimiterProvider#setRetryDelay
         * @methodOf angularRateLimiter.AngularRateLimiterProvider
         * @description
         * Configure retry delay on 'too many request' failures.
         * 
         * @param enabled {undefined|Number} Number of milliseconds to delay 
         *      request retry. Below zero like `-1` or NaN values will disable the
         *      retry feature. 
         */
        function setRetryDelay(value) {
            retryInterval = value;
        }


        /**
         * @ngdoc method
         * @name angularRateLimiter.AngularRateLimiterProvider#enableRetryFailedRequest
         * @methodOf angularRateLimiter.AngularRateLimiterProvider
         * @description
         * Enable limiters by adding interceptor to $http service. If this method 
         * is not called, then service won't do anything. 
         */
        function enableLimiters() {
            // Check is interceptor configured to $http service, if not add 
            // then add it and update the flag.
            if(!isInterceptorConfigured) {
                $httpProvider.interceptors.push('AngularRateLimiterInterceptor');
                isInterceptorConfigured = true;
            }
        }


        /**
         * @ngdoc service
         * @name angularRateLimiter.AngularRateLimiter
         * @description
         * Factory function to return AngularRateLimiter congifuration.
         * 
         * @property rules {Array} 
         * Array of limiter rules. Each rule contains two properties; matcher and bucket.
         * @property requestDelay {Number} 
         * Number of milliseconds to delay request until trying to get token again.
         * @property retryInterval {Number|undefined}
         * Number of milliseconds to delay retry request. If not positive number or is NaN
         * retry is disabled.
         */
        function angularRateLimiterFactory() {
            return {
                rules: rules,
                requestDelay: requestDelay,
                retryInterval: retryInterval
            };
        }
    });


    /**
     * @ngdoc service
     * @name angularRateLimiter.AngularRateLimiterTokenBucket
     * @description 
     * Service to get AngularRateLimiterTokenBucket class to create new token buckets.
     * 
     * @example
        <example module="angularRateLimiter">
            <file name="index.html">
                <div ng-controller="myController as ctrl">
                    <button ng-click="ctrl.throttleOperation()">Do operation</button>
                    <div>Operation pending: {{ctrl.thresholdActive}}</div>
                </div>
            </file>
            <file name="service.js">
                angular.module('myApp', ['angularRateLimiter'])
                    .controller('myController', function(AngularRateLimiterTokenBucket, $timeout) {
                        // Bucket holds max 5 tokens, and new token is added every 1s
                        var bucket = new AngularRateLimiterTokenBucket(5, 1, 1000);

                        var vm = this;
                        vm.thresholdActive = false;
                        vm.throttleOperation = function() {
                            if(bucket.tryRemoveTokens(1)) {
                                // Do operation
                                vm.thresholdActive = false;
                            }
                            else {
                                vm.thresholdActive = true;
                                // Retry after 500ms
                                $timeout(vm.throttleOperation.bind(vm), 500);
                            }
                        }
                    });
            </file>
        </example>   
     */
    ngModule.factory('AngularRateLimiterTokenBucket', function() {
        /**
         * @licence MIT
         *  Copyright (C) 2011 by John Hurliman
         * 
         *  Permission is hereby granted, free of charge, to any person obtaining a copy
         *  of this software and associated documentation files (the "Software"), to deal
         *  in the Software without restriction, including without limitation the rights
         *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
         *  copies of the Software, and to permit persons to whom the Software is
         *  furnished to do so, subject to the following conditions:
         * 
         *  The above copyright notice and this permission notice shall be included in
         *  all copies or substantial portions of the Software.
         * 
         *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
         *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
         *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
         *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
         *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
         *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
         *  THE SOFTWARE.
         */


        /**
         * A hierarchical token bucket for rate limiting. See
         * http://en.wikipedia.org/wiki/Token_bucket for more information.
         * @author John Hurliman <jhurliman@cull.tv>
         *
         * @param {Number} bucketSize Maximum number of tokens to hold in the bucket.
         *  Also known as the burst rate.
         * @param {Number} tokensPerInterval Number of tokens to drip into the bucket
         *  over the course of one interval.
         * @param {String|Number} interval The interval length in milliseconds, or as
         *  one of the following strings: 'second', 'minute', 'hour', day'.
         */
        function TokenBucket(bucketSize, tokensPerInterval, interval) {
            this.bucketSize = bucketSize;
            this.tokensPerInterval = tokensPerInterval;
            this.interval = interval;
            this.content = bucketSize;
            this.lastDrip = +new Date();
        }

        TokenBucket.prototype = {
            bucketSize: 1,
            tokensPerInterval: 1,
            interval: 1000,
            content: 0,
            lastDrip: 0,

            /**
             * Attempt to remove the requested number of tokens and return immediately.
             * If the bucket (and any parent buckets) contains enough tokens this will
             * return true, otherwise false is returned.
             * @param {Number} count The number of tokens to remove.
             * @param {Boolean} True if the tokens were successfully removed, otherwise
             *  false.
             */
            tryRemoveTokens: function tryRemoveTokens(count) {
                // Is this an infinite size bucket?
                if (!this.bucketSize) {
                    return true;
                }

                // Make sure the bucket can hold the requested number of tokens
                if (count > this.bucketSize) {
                    return false;
                }

                // Drip new tokens into this bucket
                this.drip();

                // If we don't have enough tokens in this bucket, return false
                if (count > this.content) {
                    return false;
                }

                // Remove the requested tokens from this bucket and return
                this.content -= count;
                return true;
            },

            /**
             * Add any new tokens to the bucket since the last drip.
             * @returns {Boolean} True if new tokens were added, otherwise false.
             */
            drip: function drip() {
                if (!this.tokensPerInterval) {
                    this.content = this.bucketSize;
                    return;
                }

                var now = +new Date();
                var deltaMS = Math.max(now - this.lastDrip, 0);
                this.lastDrip = now;

                var dripAmount = deltaMS * (this.tokensPerInterval / this.interval);
                this.content = Math.min(this.content + dripAmount, this.bucketSize);
            }
        };

        return TokenBucket;
    });


    /**
     * @ngdoc service
     * @name angularRateLimiter.AngularRateLimiterInterceptor
     * @description 
     * AngularRateLimiterInterceptor service which will be added to $http service by AngularRateLimiter.
     * Do not use directly.
     */
    ngModule.factory('AngularRateLimiterInterceptor', function(AngularRateLimiter, AngularRateLimiterTokenBucket, $q, $interval, $timeout, $injector) {
        // Create token buckets for each configured rule
        var limiters = [];
        angular.forEach(AngularRateLimiter.rules, function(rule) {
            limiters.push({
                matcher: rule.match,
                bucket: new AngularRateLimiterTokenBucket(rule.bucketSize, rule.tokensPerInterval, rule.tokenInterval)
            });
        });


        var interceptorConfig = {};
        // Add rate limit request handler, if we have configured rules
        if(limiters.length) {
            interceptorConfig.request = rateLimitRequests;
        }

        // Add too many requests handler if configured
        if(!isNaN(AngularRateLimiter.retryInterval) && AngularRateLimiter.retryInterval >= 0) {
            interceptorConfig.responseError = retryTooManyRequest;
        }

        // Return interceptor configuration
        return interceptorConfig;



        /**
         * Interceptor request handler function for rate limiting.
         * 
         * @param {Object} request Angular $http request object
         */
        function rateLimitRequests(request) {
            var bucket = getMatchingRateLimiterBucket(request);
            // If no matching limter is found proceed with normal flow 
            if(!bucket) {
                return request;
            }

            // Try to get token, if removed succesfully proceed with request
            if(bucket.tryRemoveTokens(1)) {
                return request;
            }

            // Failed to get token, so delay request and return promise for $http
            return delayRequest(request, bucket, AngularRateLimiter.requestDelay);
        }


        /**
         * Find matching rate limiter bucket.
         * 
         * @param {Object }request HTTP request object
         * @return {undefined|TokenBucket} Return matching bucket or undefined
         */
        function getMatchingRateLimiterBucket(request) {
            for(var i in limiters) {
                // If matching limiter found, then return the bucket
                if(matchesToRequest(limiters[i].matcher, request)) {
                    return limiters[i].bucket;
                }    
            }
        }


        /**
         * Match rule to request object.
         * 
         * @param {String|Regexp|Function} matcher String and RegExp arguments 
         *                  will be compared to request URL, if argument is 
         *                  function then request object is passed to it and 
         *                  it should return boolean value does request match.
         * @param {Object} request Angular $http request object.
         * @return {boolean} Request matches the rule.
         */
        function matchesToRequest(matcher, request) {
            if(typeof matcher === 'function') {
                return matcher(request);
            }
            else {
                return request.url.match(matcher);
            }
        }


        /**
         * Delay and retry to get token from the bucket. Return promise which 
         * is resolved when token is received from the bucket.
         * 
         * @param {Object} request Angular HTTP request object
         * @param {TokenBucket} bucket TokenBucket to be checked
         */
        function delayRequest(request, bucket, requestDelay) {
            var deferred = $q.defer();
            var retryInterval = $interval(tryToGetToken, requestDelay);

            return deferred.promise;

            function tryToGetToken() {
                if(bucket.tryRemoveTokens(1)) {
                    $interval.cancel(retryInterval);
                    retryInterval = undefined;

                    deferred.resolve(request);
                }
            }
        }


        /**
         * Retry request if HTTP error code 429 (too many requests).
         * 
         * @param {Object} response Angular $http response object
         * @return {Promise}
         */
        function retryTooManyRequest(response) {
            if(response.status === 429) {
                var deferred = $q.defer();
                var requestConfiguration = response.config;
                var $http = $injector.get('$http');

                $timeout(function() {
                    deferred.resolve($http(requestConfiguration));
                }, AngularRateLimiter.retryInterval);
                return deferred.promise;
            }
            else {
                return $q.reject(response);
            }
        }
    });

})(window.angular);