const { describe, it, before, afterEach, } = require('mocha')
const assert = require('assert');
const Pagination = require('../src/pagination');
const Request = require('../src/request');
const { createSandbox } = require('sinon');


describe('Pagination tests', function () {
    let sandbox

    before(() => {
        sandbox = createSandbox()

    })
    afterEach(() => sandbox.restore())
    describe('#Pagination', () => {
        it(`should have default options on Pagination instance`, () => {
            const pagination = new Pagination();
            const expectedProperties = {
                request: {},

                maxRetries: 4,
                retryTimeout: 1000,
                threshold: 200,
                maxRequestTimeout: 1000,
            }

            assert.ok(pagination.request instanceof Request)
            assert.deepStrictEqual(JSON.stringify(pagination), JSON.stringify(expectedProperties))
        })

        it(`should set default options on Pagination instance`, () => {
            const params = {
                maxRetries: 2,
                retryTimeout: 100,
                threshold: 10,
                maxRequestTimeout: 10,
            }

            const pagination = new Pagination(params);
            const expectedProperties = {
                request: {},
                ...params
            }

            assert.ok(pagination.request instanceof Request)
            assert.deepStrictEqual(JSON.stringify(pagination), JSON.stringify(expectedProperties))
        })
    })

    describe('#handleRequest', () => {

        it(`should retry an request twice before throwing an exception and validate request params and flow`, async () => {
            const expectedCallCount = 2
            const expectedTimeout = 10

            const pagination = new Pagination();
            pagination.maxRetries = expectedCallCount
            pagination.retryTimeout = expectedTimeout
            pagination.maxRequestTimeout = expectedTimeout

            const error = new Error("timeout")
            sandbox.stub(
                pagination.request,
                pagination.request.makeRequest.name,
            ).throws(error)

            sandbox.stub(
                Pagination,
                Pagination.sleep.name,
            ).resolves()


            sandbox.spy(pagination, pagination.handleRequest.name)

            const dataRequest = { url: 'google.com', page: 0 }
            await assert.rejects(pagination.handleRequest(dataRequest), error)
            assert.deepStrictEqual(pagination.handleRequest.callCount, expectedCallCount)

            const lastCall = 1
            assert.deepStrictEqual(pagination.handleRequest.getCall(lastCall).firstArg.retries, expectedCallCount)

            const data = {
                url: `${dataRequest.url}?tid=${dataRequest.page}`,
                method: 'get',
                timeout: expectedTimeout
            }
            assert.deepStrictEqual(pagination.request.makeRequest.getCall(0).args, [data])
            assert.ok(Pagination.sleep.calledWithExactly(expectedTimeout))

        })
        it(`should return data from request when succeded`, async () => {
            const data = { result: 'ok' }
            const pagination = new Pagination();
            sandbox.stub(
                pagination.request,
                pagination.request.makeRequest.name,
            ).resolves(data)


            const result = await pagination.handleRequest({ url: 'google.com', page: 1 })
            assert.deepStrictEqual(result, data)
        })
    })

    describe('#getPaginated', () => {
        const responseMock = [
            {
                tid: 770001,
                date: 1502558103,
                type: 'buy',
                price: 12900,
                amount: 0.001
            },
            {
                tid: 770002,
                date: 1502558103,
                type: 'sell',
                price: 12900,
                amount: 0.001
            },
        ]

        it(`should update page id on each request`, async () => {
            const pagination = new Pagination();

            sandbox.stub(
                Pagination,
                Pagination.sleep.name,
            ).resolves()

            sandbox.stub(
                pagination,
                pagination.handleRequest.name
            )
                .onCall(0).resolves([responseMock[0]])
                .onCall(1).resolves([responseMock[1]])
                .onCall(2).resolves([])

            sandbox.spy(pagination, pagination.getPaginated.name)
            const data = { url: 'google.com', page: 1 }
            const secondCallExpectation = { ...data, page: responseMock[0].tid, }
            const thirdCallExpectation = { ...secondCallExpectation, page: responseMock[1].tid }

            for await (const result of pagination.getPaginated(data)) { }

            assert.deepStrictEqual(pagination.handleRequest.getCall(0).firstArg, data)
            assert.deepStrictEqual(pagination.handleRequest.getCall(1).firstArg, secondCallExpectation)
            assert.deepStrictEqual(pagination.handleRequest.getCall(2).firstArg, thirdCallExpectation)


        })
        it(`should stop requesting when request returns an empty array`, async () => {
            const expectedThreshold = 20
            const pagination = new Pagination();
            pagination.threshold = expectedThreshold

            sandbox.stub(
                Pagination,
                Pagination.sleep.name,
            ).resolves()

            sandbox.stub(
                pagination,
                pagination.handleRequest.name
            )
                .onCall(0).resolves([responseMock[0]])
                .onCall(1).resolves([])
            const data = { url: 'google.com', page: 1 }
            const iterator = await pagination.getPaginated(data)
            const [firstResult, secondResult] = await Promise.all([iterator.next(), iterator.next()])
            
            const expectedFirstCall = { done: false, value: [responseMock[0]] }
            assert.deepStrictEqual(firstResult, expectedFirstCall)
            
            const expectedSecondCall = { done: true, value: undefined }
            assert.deepStrictEqual(secondResult, expectedSecondCall)

            assert.deepStrictEqual(Pagination.sleep.callCount, 1)
            assert.ok(Pagination.sleep.calledWithExactly(expectedThreshold))


        })
    })

})
