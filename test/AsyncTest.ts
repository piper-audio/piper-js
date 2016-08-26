/**
 * Created by lucas on 26/08/2016.
 */
/// <reference path="../typings/globals/mocha/index.d.ts" />
/// <reference path="../typings/modules/chai/index.d.ts" />
/// <reference path="../typings/modules/chai-as-promised/index.d.ts" />

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.should();
chai.use(chaiAsPromised);

function someAsyncWork(timeMs: number, work: () => any): Promise<number> {
    return new Promise((resolve) => {
        setTimeout(function () {
            resolve(work());
        }, timeMs);
    });
}

describe('some async', function () {
    this.timeout(0);
    it('is setup right', () => {
        return someAsyncWork(100, () => 1 ).should.eventually.equal(1);
    });

    it('runs async function on collection, in sequence', (done) => {
        const order: number[] = [];
        const nums = [1, 2, 3, 4, 5, 6, 7];
        const p = nums.reduce(
            (promise, item) => {
                return promise.then(() => {
                    return someAsyncWork(item * 100, () => {
                        order.push(item);
                    });
                });
            }, Promise.resolve(0)
        );
        // TODO Write the same thing using chai to make assertions clearer
        p.then(() => {
            order.should.deep.equal(nums);
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('runs a function on collection, in parallel', (done) => {
        const order: number[] = [];
        const nums = [1, 2, 3, 4, 5, 6, 7];
        const p = Promise.all(nums.map(
            (item) => someAsyncWork(100 / item, () => {
                order.push(item);
                return item;
            }))
        );
        // TODO Write the same thing using chai to make assertions clearer
        p.then(() => {
            order.should.not.deep.equal(nums);
            for (let num of nums) {
                order.should.contain(num);
            }
            done();
        }).catch((err) => {
            done(err);
        });
    });
});
