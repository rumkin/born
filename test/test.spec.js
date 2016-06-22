'use strict';

const Born = require('..');
const assert = require('assert');

describe('BORN', function () {
    it('Should properly decode encoded data', function () {
        var now = new Date();
        var data = {
          array1: [
            1,
            2,
            -1,
            1.1,
            256,
            -256,
            true,
            false,
            {
                null: null,
                string: 'hello'
            },
            now,
          ],
          buffer: new Buffer('0001', 'hex')
        };

        var out = Born.decode(Born.encode(data));
        assert.deepStrictEqual(data, out);
    });

    it('Should encode typed objects', function(){
        var born = new Born({
            customTypes: {
                RegExp: {
                    type: RegExp,
                    encode(value, writer, encode) {
                        encode([value.source, value.flags])
                    },
                    decode(reader, decoder) {
                        var value = decoder();
                        return new RegExp(value[0], value[1]);
                    }
                }
            }
        });

        var regex = born.decode(born.encode(/abc/i));

        assert.ok(regex instanceof RegExp, 'Result is regexp');
        assert.equal(regex.source, 'abc', 'Result source is "abc"');
        assert.equal(regex.flags, 'i', 'Result is flags is "i"');
    });

    it('Should encode custom typed objects', function(){
        function Test(x) {
            this.x = x;
        }

        Test.prototype.valueOf = function (){
            return {x: this.x};
        };

        Test.fromValue = function(value) {
            return new this(value.x);
        };

        var born = new Born({
            customTypes: {
                Test: {
                    type: Test
                }
            }
        });

        var test = born.decode(born.encode(new Test(10)));

        assert.ok(test instanceof Test, 'Result is a Test');
        assert.equal(test.x, 10, 'Result x is 10');
    });
});
