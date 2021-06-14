export type CSTLeaf = string | null;

export interface CSTSeq {
  type: "seq";
  children: [CSTNode, CSTNode, ...CSTNode[]];
}

export interface CSTMany {
  type: "many";
  children: CSTNode[];
}

export type CSTNode = CSTLeaf | CSTSeq | CSTMany;

interface Matched<T extends CSTNode> {
  readonly matched: true;
  readonly output: T;
  readonly rest: string;
}

export function matched<T extends CSTNode>(
  output: T,
  rest: string
): Matched<T> {
  return { matched: true, output, rest };
}

interface NotMatched {
  readonly matched: false;
}

export function notMatched(): NotMatched {
  return { matched: false };
}

export type Result<T extends CSTNode> = Matched<T> | NotMatched;

export type Parser<T extends CSTNode> = (input: string) => Result<T>;

export function str(s: string): Parser<string> {
  return input => {
    const trimmed = input.trimStart();
    if (trimmed.startsWith(s)) {
      return matched(s, trimmed.slice(s.length));
    } else {
      return notMatched();
    }
  };
}

export function re(pattern: RegExp): Parser<string> {
  return input => {
    const trimmed = input.trimStart();
    const result = pattern.exec(trimmed);
    if (result?.index === 0) {
      const match = result[0] as string;
      return matched(match, trimmed.slice(match.length));
    } else {
      return notMatched();
    }
  };
}

type TwoOrMoreParsers = [
  Parser<CSTNode>,
  Parser<CSTNode>,
  ...Parser<CSTNode>[]
];

export function or<Ps extends TwoOrMoreParsers>(
  ...parsers: Ps
): Parser<CSTNode> {
  return input => {
    for (const parser of parsers) {
      const result = parser(input);
      if (result.matched) {
        return result;
      }
    }

    return notMatched();
  };
}

export function seq<Ps extends TwoOrMoreParsers>(
  ...parsers: Ps
): Parser<CSTSeq> {
  return input => {
    let currentInput = input;
    const children = [];
    for (const parser of parsers) {
      const result = parser(currentInput);
      if (!result.matched) {
        return notMatched();
      }

      currentInput = result.rest;
      children.push(result.output);
    }

    return matched({ type: "seq", children } as CSTSeq, currentInput);
  };
}

export function many<T extends CSTNode>(
  parser: Parser<T>
): (input: string) => Matched<CSTMany> {
  return input => {
    let currentInput = input;
    const children: CSTNode[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = parser(currentInput);
      if (!result.matched) break;

      currentInput = result.rest;
      children.push(result.output);
    }

    return matched({ type: "many", children }, currentInput);
  };
}

export function many1<T extends CSTNode>(parser: Parser<T>): Parser<CSTMany> {
  const manyParser = many(parser);
  return input => {
    const result = manyParser(input);
    if (result.output.children.length > 0) {
      return result;
    } else {
      return notMatched();
    }
  };
}

export function maybe<T extends CSTNode>(parser: Parser<T>): Parser<T | null> {
  return input => {
    const result = parser(input);
    if (result.matched) {
      return result;
    } else {
      return matched(null, input);
    }
  };
}
