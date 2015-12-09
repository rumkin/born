'use strict';

var Writer = require('buffer-write');

exports.encode = encode;
exports.decode = decode;

var types = {
  null: 0x00,
  object: 0x01,
  array: 0x02,
  buffer: 0x03,
  string: 0x04,
  boolean: 0x05,
  date: 0x06,
  numberPositive: 0x07,
  numberNegative: 0x08,
};

function encodeBorn(value, writer) {
    if (arguments.length < 2) {
        writer = new Writer();
    }

    switch (typeof value) {
        case "object":
            if (value === null) {
                writer.writeUInt16BE(types.null);
            } else if (Array.isArray(value)) {
                writer.writeUInt16BE(types.array);
                let length = value.length;
                writer.writeUInt32BE(length);

                // TODO write array length
                writer.writeUInt32BE(0);
                var l = value.length;
                var i = -1;
                while (++i < l) {
                    encodeBorn(value[i], writer);
                }
            } else if (Buffer.isBuffer(value)) {
                writer.writeUInt16BE(types.buffer);
                writer.writeUInt32BE(value.length);
                writer.write(value);
            } else if (value instanceof Date) {
                writer.writeUInt16BE(types.date);

                writer.writeUInt16BE(value.getFullYear());
                writer.writeUInt8(value.getMonth());
                writer.writeUInt8(value.getDate());

                writer.writeUInt8(value.getHours());
                writer.writeUInt8(value.getMinutes());
                writer.writeUInt8(value.getSeconds());
                writer.writeUInt16BE(value.getMilliseconds());

                var timezone = value.getTimezoneOffset();
                if (timezone < 0) {
                    writer.writeUInt8(0);
                } else {
                    writer.writeUInt8(1);
                }

                writer.writeUInt16BE(Math.abs(timezone));
            } else {
                if (value.constructor !== Object) {
                    value = value.valueOf();
                }

                writer.writeUInt16BE(types.object);

                var keys = Object.getOwnPropertyNames(value);
                writer.writeUInt32BE(keys.length);

                // TODO write object length
                writer.writeUInt32BE(0);

                var l = keys.length;
                var i = -1;
                while (++i < l) {
                    encodeBorn(keys[i], writer);
                    encodeBorn(value[keys[i]], writer);
                }
            }
            break;
        case "string":
            writer.writeUInt16BE(types.string);
            writer.writeUInt32BE(Buffer.byteLength(value));
            writer.write(value);
            break;
        case "boolean":
            writer.writeUInt16BE(types.boolean);
            writer.writeUInt8(value ? 0x01 : 0x00);
            break;
        case "number":
            if (value >= 0) {
                writer.writeUInt16BE(types.numberPositive);
                writer.writeUInt32BE(value);
            } else {
                writer.writeUInt16BE(types.numberNegative);
                writer.writeUInt32BE(-value);
            }
            break;
        default:
            throw new Error("unsupported type '" + (typeof value) + "'");
    }

    return writer;
}

function encode(value) {
    return encodeBorn(value).toBuffer();
}

function decodeBorn(reader) {
    var result;

    var buffer = reader.buffer;
    var length = buffer.length;

    var type = buffer.readUInt16BE(reader.offset);
    reader.offset += 2;

    switch (type) {
    case types.null:
        return null;
    case types.object:
        result = {};
        var n = buffer.readUInt32BE(reader.offset);
        reader.offset += 8;
        var key; value;
        while (n--) {
            key = decodeBorn(reader);
            value = decodeBorn(reader);
            result[key] = value;
        }
        return result;
    case types.array:
            var n = buffer.readUInt32BE(reader.offset);
            var i = -1;
            result = new Array(n);
            reader.offset += 8;
            var key, value;

            while (++i < n) {
                result[i] = decodeBorn(reader);
            }
            return result;
    case types.buffer:
        var length = buffer.readUInt32BE(reader.offset);
        result = buffer.slice(reader.offset + 4, length);
        var skip = reader.offset + 4;
        result = buffer.slice(skip, skip + length);
        reader.offset += skip + length;
        return result;
    case types.string:
        var length = buffer.readUInt32BE(reader.offset);
        var skip = reader.offset + 4;

        result = buffer.slice(skip, skip + length).toString('utf8');
        reader.offset += 4 + length;
        return result;
    case types.numberPositive:
        result = buffer.readUInt32BE(reader.offset);
        reader.offset += 4;
        return result;
    case types.numberNegative:
        result = -buffer.readUInt32BE(reader.offset);
        reader.offset += 4;
        return result;
    case types.boolean:
        result = buffer.readUInt8(reader.offset) === 1
            ? true
            : false;

        reader.offset += 1;
        return result;
    case types.date:
        var year = buffer.readUInt16BE(reader.offset);
        reader.offset += 2;
        var month = buffer.readUInt8(reader.offset++);
        var date = buffer.readUInt8(reader.offset++);

        var hours = buffer.readUInt8(reader.offset++);
        var minutes = buffer.readUInt8(reader.offset++);
        var seconds = buffer.readUInt8(reader.offset++);
        var milliseconds = buffer.readUInt16BE(reader.offset);
        reader.offset += 2;
        var tz = buffer.readUInt8(reader.offset++);
        var timezone = buffer.readUInt16BE(reader.offset);
        reader.offset += 2;

        var d = new Date();
        d.setFullYear(year);
        d.setMonth(month);
        d.setDate(date);
        d.setHours(hours);
        d.setMinutes(minutes);
        d.setSeconds(seconds);
        d.setMilliseconds(milliseconds);

        result = new Date(buffer.slice(skip, skip + length).toString('utf8'));
        return result;
    default:
        return null;
    }
}

function decode(buffer) {
    var reader = {
        buffer: buffer,
        offset: 0
    };

    // TODO throw error if buffer length is greater the last offset.
    return decodeBorn(reader);
}