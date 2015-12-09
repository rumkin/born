'use strict';

var Writer = require('buffer-write');

exports.encode = encode;
exports.decode = decode;

function bornType(major, minor) {
    return (major << 5) + minor;
}

// Primitives
const TYPE_NULL = bornType(0, 0);
const TYPE_TRUE = bornType(0, 1);
const TYPE_FALSE = bornType(0, 2);

// Numbers
const TYPE_INT = bornType(1, 0);
const TYPE_INT_NEG = bornType(1, 1);
const TYPE_FLOAT = bornType(1, 2);
const TYPE_FLOAT_NEG = bornType(1, 3);

// Objects, Sets, Maps and other variable length structures
const TYPE_OBJECT = bornType(2, 0);
const TYPE_ARRAY = bornType(2, 1);
const TYPE_BUFFER = bornType(2, 2);
const TYPE_STRING = bornType(2, 3);

// Others
const TYPE_DATE = bornType(3, 0);

function encodeBorn(value, writer) {
    if (arguments.length < 2) {
        writer = new Writer();
    }

    switch (typeof value) {
        case "object":
            if (value === null) {
                writer.writeUInt8(TYPE_NULL);
            } else if (Array.isArray(value)) {
                writer.writeUInt8(TYPE_ARRAY);
                var length = value.length;
                writer.writeUInt32BE(length);

                // TODO write array length
                writer.writeUInt32BE(0);
                var l = value.length;
                var i = -1;
                while (++i < l) {
                    encodeBorn(value[i], writer);
                }
            } else if (Buffer.isBuffer(value)) {
                writer.writeUInt8(TYPE_BUFFER);
                writer.writeUInt32BE(value.length);
                writer.write(value);
            } else if (value instanceof Date) {
                writer.writeUInt8(TYPE_DATE);
                writer.write(dateToISOString(value));
            } else {
                if (value.constructor !== Object) {
                    value = value.valueOf();
                }

                writer.writeUInt8(TYPE_OBJECT);

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
            writer.writeUInt8(TYPE_STRING);
            writer.writeUInt32BE(Buffer.byteLength(value));
            writer.write(value);
            break;
        case "boolean":
            if (value) {
                writer.writeUInt8(TYPE_TRUE);
            } else {
                writer.writeUInt8(TYPE_FALSE);
            }
            break;
        case "number":
        var tail = value % 1;
            if (tail === 0) {
                if (value >= 0) {
                    writer.writeUInt8(TYPE_INT);
                    writer.writeUInt32BE(value);
                } else {
                    writer.writeUInt8(TYPE_INT_NEG);
                    writer.writeUInt32BE(-value);
                }
            } else {
                if (value >= 0) {
                    writer.writeUInt8(TYPE_FLOAT);
                    writer.writeDoubleBE(value);
                } else {
                    writer.writeUInt8(TYPE_FLOAT_NEG);
                    writer.writeDoubleBE(-value);
                }
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

    var type = buffer.readUInt8(reader.offset);
    var major = type >> 5;
    // var minor = type & 31;

    reader.offset += 1;

    switch (major) {
        // Primitives
        case 0:
        // Numbers
        case 1:
            switch (type) {
                case TYPE_NULL:
                    return null;
                case TYPE_TRUE:
                    return true;
                case TYPE_FALSE:
                    return false;
                case TYPE_INT:
                    result = buffer.readUInt32BE(reader.offset);
                    reader.offset += 4;
                    return result;
                case TYPE_INT_NEG:
                    result = -buffer.readUInt32BE(reader.offset);
                    reader.offset += 4;
                    return result;
                case TYPE_FLOAT:
                    result = buffer.readDoubleBE(reader.offset);
                    reader.offset += 8;
                    return result;
                case TYPE_FLOAT_NEG:
                    result = buffer.readDoubleBE(reader.offset);
                    reader.offset += 8;
                    return -result;
            }
        break;
        // Structures
        case 2:
        // Other
        case 3:
            switch (type) {
                case TYPE_OBJECT:
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
                case TYPE_ARRAY:
                        var n = buffer.readUInt32BE(reader.offset);
                        var i = -1;
                        result = new Array(n);
                        reader.offset += 8;
                        var key, value;

                        while (++i < n) {
                            result[i] = decodeBorn(reader);
                        }
                        return result;
                case TYPE_STRING:
                    var length = buffer.readUInt32BE(reader.offset);
                    var skip = reader.offset + 4;

                    result = buffer.slice(skip, skip + length).toString('utf8');
                    reader.offset += 4 + length;
                    return result;
                case TYPE_BUFFER:
                    var length = buffer.readUInt32BE(reader.offset);
                    result = buffer.slice(reader.offset + 4, length);
                    var skip = reader.offset + 4;
                    result = buffer.slice(skip, skip + length);
                    reader.offset += skip + length;
                    return result;
                case TYPE_DATE:
                    var skip = reader.offset;
                    var dateLength = 28;

                    result = new Date(buffer.toString('utf8', skip, skip + dateLength));
                    reader.offset += dateLength;
                    return result;
            }
        break;

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


/**
 * Pad string left.
 *
 * @param  {string} str    String to pad.
 * @param  {string} pad    Pad value.
 * @param  {number} length Total length.
 * @return {string}        Padded string.
 */
function lpad(str, pad, length) {
  str = String(str);
  while (str.length < length) {
    str = pad + str;
  }

  return str.slice(-length);
}

/**
 * Convert date to ISO date.
 *
 * @param  {Date} date Date obect.
 * @return {string}      ISO date string like: 2015-10-08T18:37:32+0300
 */
function dateToISOString(date) {
  var result = date.getFullYear().toString()
    + '-' + lpad(date.getMonth() + 1, '0', 2)
    + '-' + lpad(date.getDate(), '0', 2)
    + 'T'
    + lpad(date.getHours(), '0', 2)
    + ':' + lpad(date.getMinutes(), '0', 2)
    + ':' + lpad(date.getSeconds(), '0', 2)
    + '.' + lpad(date.getMilliseconds(), '0', 3)
    + minutesToHours(date.getTimezoneOffset());

  return result;
}

function minutesToHours(minutes) {
  var sign = minutes > -1 ? '+' : '-';
  var hours = Math.abs(Math.ceil(minutes/60));
  minutes = Math.abs(minutes % 60);
  return sign + lpad(hours, '0', 2) + lpad(minutes, '0', 2);
}
