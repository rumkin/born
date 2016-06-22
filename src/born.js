'use strict';

var Writer = require('buffer-write');
module.exports = Born;
Born.encode = encode;
Born.decode = decode;

function bornType(major, minor) {
    return (major << 5) + minor;
}

// Primitives
const TYPE_NULL = bornType(0, 0);
const TYPE_TRUE = bornType(0, 1);
const TYPE_FALSE = bornType(0, 2);

// Numbers
// Integer 32
const TYPE_INT = bornType(1, 0);
const TYPE_INT_NEG = bornType(1, 1);

// Integer 64
const TYPE_FLOAT = bornType(1, 2);
const TYPE_FLOAT_NEG = bornType(1, 3);

const TYPE_INT8 = bornType(1, 4);
const TYPE_INT8_NEG = bornType(1, 5);

const TYPE_INT16 = bornType(1, 6);
const TYPE_INT16_NEG = bornType(1, 7);

// Objects, Sets, Maps and other variable length structures
const TYPE_OBJECT = bornType(2, 0);
const TYPE_ARRAY = bornType(2, 1);
const TYPE_BUFFER = bornType(2, 2);
const TYPE_STRING = bornType(2, 3);

const TYPE_OBJECT_SHORT = bornType(2, 4);
const TYPE_ARRAY_SHORT = bornType(2, 5);
const TYPE_STRING_SHORT = bornType(2, 6);

const TYPE_STRING_MIDDLE = bornType(2, 9);
// Typed object
const TYPE_TYPED_OBJECT = bornType(2, 12);

// Others
const TYPE_DATE = bornType(3, 0);

function encodeBorn(value, writer, options) {
    if (! writer) {
        writer = new Writer();
    }

    options = options || {};

    var customTypes = options.customTypes || {};
    var subencode = function(value) {
        return encodeBorn(value, writer, {
            customTypes: customTypes,
        });
    };
    if (customTypes instanceof Map === false) {
        customTypes = getCustomTypesMap(customTypes);
    }

    switch (typeof value) {
        case "object":
            if (value === null) {
                writer.writeUInt8(TYPE_NULL);
            } else if (Array.isArray(value)) {
                var length = value.length;
                if (length < 256) {
                    writer.writeUInt8(TYPE_ARRAY_SHORT);
                    writer.writeUInt8(length);
                } else {
                    writer.writeUInt8(TYPE_ARRAY);
                    writer.writeUInt32BE(length);
                }

                // TODO write array length
                // writer.writeUInt32BE(0);
                var i = -1;
                while (++i < length) {
                    encodeBorn(value[i], writer);
                }
            } else if (Buffer.isBuffer(value)) {
                writer.writeUInt8(TYPE_BUFFER);
                writer.writeUInt32BE(value.length);
                writer.write(value);
            } else if (value instanceof Date) {
                writer.writeUInt8(TYPE_DATE);
                writer.write(dateToISOString(value));
            } else if (customTypes.has(value.constructor)) {
                let ctor = value.constructor;
                let type = customTypes.get(ctor);
                writer.writeUInt8(TYPE_TYPED_OBJECT);
                writer.write(Buffer.from(type.type));
                if (type.encode) {
                    type.encode(value, writer, subencode);
                } else if ('valueOf' in ctor.prototype && typeof ctor.prototype.valueOf === 'function') {
                    subencode(value.valueOf());
                } else {
                    throw new Error('Invalid type "' + type.type);
                }
            } else {
                if (value.constructor !== Object) {
                    value = value.valueOf(); // custom object...
                }

                let keys = Object.getOwnPropertyNames(value);
                let length = keys.length;
                if (length < 256) {
                    writer.writeUInt8(TYPE_OBJECT_SHORT);
                    writer.writeUInt8(length);
                } else {
                    writer.writeUInt8(TYPE_OBJECT);
                    writer.writeUInt32BE(length);
                }
                let bi = writer._parts.length - 1;
                // TODO write object length
                // writer.writeUInt32BE(0);

                let i = -1;
                let elements = 0;
                let key;
                while (++i < length) {
                    key = keys[i];
                    if (value[key] === undefined) {
                        continue;
                    }
                    encodeBorn(key, writer);
                    encodeBorn(value[key], writer, {customTypes: customTypes});
                    elements++;
                }
                writer._parts[bi].value = elements;
            }
            break;
        case "string":
            var byteLength = Buffer.byteLength(value);
            if (byteLength < 255) {
                writer.writeUInt8(TYPE_STRING_SHORT);
                writer.writeUInt8(byteLength);
            } else if (byteLength < 65536) {
                writer.writeUInt8(TYPE_STRING_MIDDLE);
                writer.writeUInt16BE(byteLength);
            } else {
                writer.writeUInt8(TYPE_STRING);
                writer.writeUInt32BE(byteLength);
            }
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
                var abs = Math.abs(value);
                if (abs < 256) {
                    if (value >= 0) {
                        writer.writeUInt8(TYPE_INT8);
                        writer.writeUInt8(value);
                    } else {
                        writer.writeUInt8(TYPE_INT8_NEG);
                        writer.writeUInt8(-value);
                    }
                } else {
                    if (value >= 0) {
                        writer.writeUInt8(TYPE_INT);
                        writer.writeUInt32BE(value);
                    } else {
                        writer.writeUInt8(TYPE_INT_NEG);
                        writer.writeUInt32BE(-value);
                    }
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
        case 'undefined':
            // TODO skip undefined properties and values
            writer.writeUInt8(TYPE_NULL);
            break;
        default:
            throw new Error('unsupported type "' + (typeof value) + '"');
    }

    return writer;
}

function encode(value, options) {
    return encodeBorn(value, null, options).toBuffer();
}

function decodeBorn(reader, options) {
    var result;

    var buffer = reader.buffer;
    var length = buffer.length;

    var type = buffer.readUInt8(reader.offset);
    var major = type >> 5;
    // var minor = type & 31;
    options = options || {};
    var customTypes = options.customTypes || {};
    if (!(customTypes instanceof Map)) {
        customTypes = getCustomTypesMap(customTypes);
    }

    var subdecoder= function() {
        return decodeBorn(reader, {customTypes: customTypes});
    };

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
                case TYPE_INT8:
                    result = buffer.readUInt8(reader.offset);
                    reader.offset += 1;
                    return result;
                case TYPE_INT8_NEG:
                    result = -buffer.readUInt8(reader.offset);
                    reader.offset += 1;
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
                    reader.offset += 4;
                    var key; value;
                    while (n--) {
                        key = subdecoder();
                        value = subdecoder(reader);
                        result[key] = value;
                    }
                    return result;
                case TYPE_OBJECT_SHORT:
                    result = {};
                    var n = buffer.readUInt8(reader.offset);
                    reader.offset += 1;
                    var key; value;
                    while (n--) {
                        key = subdecoder(reader);
                        value = subdecoder(reader);
                        result[key] = value;
                    }
                    return result;
                case TYPE_ARRAY:
                    var n = buffer.readUInt32BE(reader.offset);
                    var i = -1;
                    result = new Array(n);
                    reader.offset += 4;
                    var key, value;

                    while (++i < n) {
                        result[i] = subdecoder(reader);
                    }
                    return result;
                case TYPE_ARRAY_SHORT:
                    var n = buffer.readUInt8(reader.offset);
                    var i = -1;
                    result = new Array(n);
                    reader.offset += 1;
                    var key, value;

                    while (++i < n) {
                        result[i] = subdecoder(reader);
                    }
                    return result;
                case TYPE_STRING:
                    var length = buffer.readUInt32BE(reader.offset);
                    var skip = reader.offset + 4;

                    result = buffer.slice(skip, skip + length).toString('utf8');
                    reader.offset += 4 + length;
                    return result;
                case TYPE_STRING_SHORT:
                    var length = buffer.readUInt8(reader.offset);
                    var skip = reader.offset + 1;

                    result = buffer.slice(skip, skip + length).toString('utf8');
                    reader.offset += 1 + length;
                    return result;
                case TYPE_STRING_MIDDLE:
                    var length = buffer.readUInt16BE(reader.offset);
                    var skip = reader.offset + 2;

                    result = buffer.slice(skip, skip + length).toString('utf8');
                    reader.offset += 2 + length;
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
                case TYPE_TYPED_OBJECT:
                    let typeName = buffer.toString('utf8', reader.offset, reader.offset + 16);

                    if (! customTypes.has(typeName)) {
                        throw new Error('Decoding error: unknown type');
                    }
                    reader.offset += 16;
                    let desc = customTypes.get(typeName);

                    if (desc.decode) {
                        return desc.decode(reader, subdecoder);
                    } else if (typeof desc.type.fromValue === 'function') {
                        return desc.type.fromValue(subdecoder());
                    } else {
                        throw new Error('Invalid type "' + typeName + '"');
                    }
            }
        break;

        default:
            return null;
    }
}

function decode(buffer, options) {
    var reader = {
        buffer: buffer,
        offset: 0
    };

    // TODO throw error if buffer length is greater the last offset.
    return decodeBorn(reader, options);
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

function getCustomTypesMap(customTypes) {
    var types = new Map();

    Object.getOwnPropertyNames(customTypes)
    .forEach(function(name){
        var desc = customTypes[name];
        var code = (name + ' '.repeat(16)).slice(0, 16);

        types.set(desc.type, {
            type: code,
            encode: desc.encode,
        });

        types.set(code, {
            type: desc.type,
            decode: desc.decode,
        });
    });

    return types;
}

function Born(options = {}) {
    this.customTypes = getCustomTypesMap(options.customTypes || {});
};

Born.prototype.encode = function (value) {
    return encode(value, {
        customTypes: this.customTypes
    });
};

Born.prototype.decode = function (value) {
    return decode(value, {
        customTypes: this.customTypes
    });
};
