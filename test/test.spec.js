var born = require('..');
var assert = require('assert');

describe('BORN', function () {
    it('Should properly decode encoded data', function () {
        var now = new Date();
        var data = {
          array1: [
            1,
            2,
            -1,
            1.1,
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

        var out = born.decode(born.encode(data));
        assert.deepStrictEqual(data, out);
    });
});
