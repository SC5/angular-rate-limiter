describe('AngularRateLimiterInterceptor', function() {
    // Load module
    beforeEach(module('angularRateLimiter'));

    describe('service', function() {
        it('is empty when no configuration', function(done) {
            // Mock configuration
            module(function($provide) {
                $provide.value('AngularRateLimiter', {
                    rules: [],
                    retryInterval: -1
                });
            });

            inject(function(AngularRateLimiterInterceptor) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).toBe(undefined);
                expect(interceptor.responseError).toBe(undefined);
                done();
            });
        });


        it('has retry handler when configured', function(done) {
            // Mock configuration
            module(function($provide) {
                $provide.value('AngularRateLimiter', {
                    rules: [],
                    retryInterval: 10
                });
            });

            inject(function(AngularRateLimiterInterceptor) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).toBe(undefined);
                expect(interceptor.responseError).not.toBe(undefined);
                done();
            });
        });


        it('has request handler when configured', function(done) {
            // Mock configuration
            module(function($provide) {
                $provide.value('AngularRateLimiter', {
                    rules: [{
                        match: '',
                        bucketSize: 10,
                        tokensPerInterval: 10,
                        tokenInterval: 1000
                    }]
                });
            });

            inject(function(AngularRateLimiterInterceptor) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).not.toBe(undefined);
                done();
            });
        });
    });

    describe('request limiter', function() {
        // Init sinon timers
        beforeEach(function() {
            this.fakeTimer = new sinon.useFakeTimers();
        });

        // Restore normal timers
        afterEach(function() {
            this.fakeTimer.restore();
        });

        // Mock configuration
        beforeEach(module(function($provide) {
            $provide.value('AngularRateLimiter', {
                rules: [
                    {
                        match: 'mydomain.com',
                        bucketSize: 2,
                        tokensPerInterval: 2,
                        tokenInterval: 100
                    },
                    {
                        // Match all protocols and hosts 'api' and 'rest' for domain test.com 
                        match: /^(.*):\/\/(api|rest).test.com/,
                        bucketSize: 2,
                        tokensPerInterval: 2,
                        tokenInterval: 100                        
                    },
                    {
                        match: function(request) {
                            return false;
                        },
                        bucketSize: 2,
                        tokensPerInterval: 2,
                        tokenInterval: 100                        
                    }
                ],
                requestDelay: 50,
                retryInterval: 0
            });
        }));


        it('limits request to configured rule', function(done) {
            inject(function(AngularRateLimiterInterceptor, $interval) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).not.toBe(undefined);

                var requestObject = {
                    url: 'https://api.mydomain.com/rest'
                };

                // Request handler should return first 2 request directly 
                expect(interceptor.request(requestObject)).toBe(requestObject);
                expect(interceptor.request(requestObject)).toBe(requestObject);

                // 3rd request should be limited and promise is returned
                var response = interceptor.request(requestObject);
                expect(response).not.toBe(requestObject);
                expect(typeof response.then).toBe('function');

                // Promise is resolved with request data when token is available
                response.then(function(promiseResponse) {
                    expect(promiseResponse).toBe(requestObject);
                    done();
                });

                // Use fake timers to shift time and flush angular $interval
                this.fakeTimer.tick(50);
                $interval.flush(50);
            });
        });


        it('does not limit request which does not match rule', function() {
            inject(function(AngularRateLimiterInterceptor) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).not.toBe(undefined);

                var requestObject = {
                    url: 'https://example.com'
                };

                // Request handler should return all request directly 
                expect(interceptor.request(requestObject)).toBe(requestObject);
                expect(interceptor.request(requestObject)).toBe(requestObject);
                // After this limiter should work if requests would match
                expect(interceptor.request(requestObject)).toBe(requestObject);
                expect(interceptor.request(requestObject)).toBe(requestObject);
            });
        });


        it('limit with RegExp matching rule', function() {
            inject(function(AngularRateLimiterInterceptor) {
                var interceptor = AngularRateLimiterInterceptor;
                expect(interceptor.request).not.toBe(undefined);

                var requestObject1 = { url: 'https://api.test.com' };
                var requestObject2 = { url: 'http://rest.test.com' };
                var requestObject3 = { url: 'http://www.test.com' };

                // Request handler should return first 2 to api.test.com request directly 
                expect(interceptor.request(requestObject1)).toBe(requestObject1);
                expect(interceptor.request(requestObject1)).toBe(requestObject1);
                
                // Limiter should return promise on 3rd request
                expect(interceptor.request(requestObject1)).not.toBe(requestObject1);

                // Limiter should return promise for rest.test.com
                expect(interceptor.request(requestObject2)).not.toBe(requestObject2);

                // Limiter should not match to www.test.com
                expect(interceptor.request(requestObject3)).toBe(requestObject3);
            });
        });
    });
});