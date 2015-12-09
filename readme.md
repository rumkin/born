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

**NOTE** Alpha version does not support int64 numbers.

## Types

### NULL

```
0x00 - NULL type byte
```

### True

```
0x01 - Boolean true type byte
```

### False

```
0x02 - Boolean true type byte
```

### Positive integer

```
0x20 - Positive integer type byte
00 00 00 00 - uint32 - Absolute integer value
```

### Negative integer

```
0x21 - Negative integer type byte
00 00 00 00 - uint32 - Absolute integer value
```

### Positive float

```
0x20 - Positive float type byte
00 00 00 00 00 00 00 00 - double - Absolute float value
```

### Negative float

```
0x21 - Negative float type byte
00 00 00 00 00 00 00 00 - double - Absolute float value
```

### Object

```
0x40 - Object type byte
00 00 00 00 - uint32 - Object keys length
00 00 00 00 - uint32 - Object bytes length. Null if unknown.
... - Data key pairs
```

### Array

```
0x41 - Array type byte
00 00 00 00 - uint32 - Array items length
00 00 00 00 - uint32 - Array bytes length. Null if unknown.
... - Data values
```

### Buffer

```
0x42 - Buffer type byte
00 00 00 00 - uint32 - Buffer bytes length.
... - Buffer bytes
```

### String

```
0x43 - String type byte
00 00 00 00 - uint32 - String bytes length.
... - Chars
```

### Date

Date stored as a string representation of ISO Date. It has format
`YYYYMMDDTHHmmss.msZ`.

```
0x60 - Date type byte
... - [28]byte - Date ISO string.
```
