describe('TokenBucket', function() {
    var TokenBucket;

    // Load module
    beforeEach(module('angularRateLimiter'));

    // Get TokenBucket service
    beforeEach(inject(function(AngularRateLimiterTokenBucket) {
        TokenBucket = AngularRateLimiterTokenBucket;
    }));

    // Init sinon timers
    beforeEach(function() {
        this.fakeTimer = new sinon.useFakeTimers();
    });

    // Restore normal timers
    afterEach(function() {
        this.fakeTimer.restore();
    });


    it('limits request to bucket size', function() {
        // 10 per second with drip 1 token per 100ms
        var limiter = new TokenBucket(10, 1, 100);

        // Remove one ...
        expect(limiter.tryRemoveTokens(1)).toBe(true);
        // ... should have 9 left
        expect(limiter.content).toBe(9);

        // Remove 8 ...
        expect(limiter.tryRemoveTokens(8)).toBe(true);

        // Should not allow to remove more than tokens in bucket
        expect(limiter.tryRemoveTokens(2)).toBe(false);

        // Remove last token
        expect(limiter.tryRemoveTokens(1)).toBe(true);
        // ... content bucket should be empty 
        expect(Math.floor(limiter.content)).toBe(0);

        // Should not allow to remove any more
        expect(limiter.tryRemoveTokens(1)).toBe(false);
    });

    it('drips tokens correctly', function() {
        // 10 per second with drip 1 token every 100ms
        var limiter = new TokenBucket(10, 1, 100);

        // Verify that ew have 10 tokens and take them all
        expect(limiter.content).toBe(10);
        expect(limiter.tryRemoveTokens(10)).toBe(true);

        // Verify that there are no tokens and removing fails 
        expect(limiter.content).toBe(0);
        expect(limiter.tryRemoveTokens(1)).toBe(false);

        // Jump ahead 50ms from start and verify that no tokens have been added
        this.fakeTimer.tick(51);
        limiter.drip();
        expect(Math.floor(limiter.content)).toBe(0);

        // Jump ahead 100ms from start and verify that we have new token
        this.fakeTimer.tick(50);
        limiter.drip();
        expect(Math.floor(limiter.content)).toBe(1);

        // Jump ahead 200ms from start and verify that we have second token
        this.fakeTimer.tick(100);
        limiter.drip();
        expect(Math.floor(limiter.content)).toBe(2);

        // Remove 2 tokens and verify that bucket is empty again
        expect(limiter.tryRemoveTokens(2)).toBe(true);
        expect(Math.floor(limiter.content)).toBe(0);
        expect(limiter.tryRemoveTokens(1)).toBe(false);

        // Jump ahead 300ms from start and verify that we have again one token
        this.fakeTimer.tick(100);
        limiter.drip();
        expect(Math.floor(limiter.content)).toBe(1);

        // Jump ahead 2000ms from start and verify that there only bucket size of tokens
        this.fakeTimer.tick(1700);
        limiter.drip();
        expect(Math.floor(limiter.content)).toBe(10);
    });
});