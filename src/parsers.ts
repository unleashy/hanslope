export type CSTNode = string | null;

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
