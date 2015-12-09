BORN
---

Binary object representation notation is a full JSON analogue but for binary
world. It supports the same data types except of two `Date` and `Buffer`.

## Reason

The main reason of creating new binary data is simplification of interprocess
communications like IPC, RPC and so. Standard JSON does not support binary data
and could transfer data in base64 with huge overloads.

BORN is dead simple and has no compatibility breaking extensions. Also it has
no custom types.

## Implementation

This is the first experimental implementation in pure JavaScript and it's
already faster then CBOR (on encode/decode) and a just little bit faster then
MsgPack written in C++ (on decode, but not encode yet). So I believe it has a potential to future optimization.

**NOTE** Alpha version does not support float and int64 numbers.

## Specification

### NULL

```
00 - NULL type byte
```

### Object

```
01 - Object type byte
00 00 - uint32 - Object keys length
00 00 - uint32 - Object bytes length. Null if unknown.
... - Data key pairs
```

### Array

```
02 - Array type byte
00 00 - uint32 - Array items length
00 00 - uint32 - Array bytes length. Null if unknown.
... - Data values
```

### Buffer

```
03 - Buffer type byte
00 00 - uint32 - Buffer bytes length.
... - Buffer bytes
```

### String

```
04 - String type byte
00 00 - uint32 - String bytes length.
... - Chars
```

### Boolean

```
05 - Boolean type byte
00 - uint8 - Boolean value
```

### Date

Date stored as a string representation of ISO Date. It has format
`YYYYMMDDTHHmmss.msZ`.

```
02 - Date type byte
... - Date ISO string.
```

### Positive number

```
07 - Positive number type byte
00 00 - uint32 - Absolute number value
```

### Negative number

```
08 - Negative number type byte
00 00 - uint32 - Absolute number value
```
