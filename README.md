# Hanslope

**Hanslope** is a library for generating parsers using
[Babel macros](https://github.com/kentcdodds/babel-plugin-macros).

Currently, the above aspect is not implemented. That will come after the
rudiments are done.

```typescript
import { grammar } from "hanslope/macro";

const polishNotationParser = grammar`
  Expression <- Operator:op Term+:terms
  Term       <- Number:value
              / "(" Expression ")"
  Operator   <- /[+\-*\/]/
  Number     <- /[0-9]+/
`;

const ast = polishNotationParser("+ 2 (* 3 6)");
// => { op: "+",
//      terms: [
//        { value: "2" },
//        { op: "*",
//          terms: [
//            { value: "3" },
//            { value: "6" }]}]}
```

## Licence

[MIT.](LICENSE.txt)
