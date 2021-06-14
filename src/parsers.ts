interface Matched<T> {
  readonly matched: true;
  readonly output: T;
  readonly rest: string;
}

function matched<T>(output: T, rest: string): Matched<T> {
  return { matched: true, output, rest };
}

interface NotMatched {
  readonly matched: false;
}

function notMatched(): NotMatched {
  return { matched: false };
}

type Result<T> = Matched<T> | NotMatched;

type Parser<T> = (input: string) => Result<T>;

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
