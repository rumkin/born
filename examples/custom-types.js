const Born = require('../');


function SomeType(x, y) {
    this.x = x;
    this.y = y;
};

SomeType.prototype.sum = function (){
    return this.x + this.y;
};

class OtherType extends SomeType {
    mul() {
        return this.x * this.y;
    }
}

const customTypes = {
    'SomeType': {
        type: SomeType,
        encode(value, writer, encoder) {
            writer.writeUInt8(value.x);
            writer.writeUInt8(value.y);
        },
        decode(reader) {
            var x = reader.buffer.readUInt8(reader.offset);
            reader.offset += 1;
            var y = reader.buffer.readUInt8(reader.offset);
            reader.offset += 1;

            return new SomeType(x, y);
        }
    },
    'OtherType': {
        type: OtherType,
        encode(value, writer, encoder) {
            writer.writeUInt8(value.x);
            writer.writeUInt8(value.y);
        },
        decode(reader) {
            var x = reader.buffer.readUInt8(reader.offset);
            reader.offset += 1;
            var y = reader.buffer.readUInt8(reader.offset);
            reader.offset += 1;

            return new OtherType(x, y);
        }
    }
};

const born = new Born({
    customTypes
});

var encoded = born.encode({
    someProp: new SomeType(1, 1),
    otherProp: new OtherType(2, 2),
});

var decoded = born.decode(encoded);

console.log('result', encoded);
console.log('result', decoded);
console.log('result', decoded.someProp.sum());
console.log('result', decoded.otherProp.mul());
