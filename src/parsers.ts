import { CSTMany, CSTNode, CSTSeq, CSTTagged } from "./cst";

/**
 * Represents a parse match.
 * @typeParam T - the type of the {@link Matched.output}’s {@link CSTNode | CST node}
 */
export interface Matched<T extends CSTNode> {
  readonly matched: true;

  /**
   * {@link CSTNode | CST node} built as a result of the parse.
   */
  readonly output: T;

  /**
   * The rest of the input after the parse was done.
   */
  readonly rest: string;
}

/** @internal */
export function matched<T extends CSTNode>(
  output: T,
  rest: string
): Matched<T> {
  return { matched: true, output, rest };
}

/**
 * Represents a parse failure.
 */
export interface NotMatched {
  readonly matched: false;

  /**
   * The rest of the input after the parse was done.
   */
  readonly rest: string;

  /**
   * A failure label, used to distinguish from explicit failures thrown by
   * {@link fail} and implicit failures that may backtrack, in which case this
   * is `null`.
   */
  readonly label: string | null;
}

/** @internal */
export function notMatched(
  rest: string,
  label: string | null = null
): NotMatched {
  return { matched: false, rest, label };
}

/**
 * Parses some input, returning either a match ({@link Matched}) or a failure
 * ({@link NotMatched}).
 *
 * @remarks
 * Parsers only ever take the start of the input string into account, and on
 * match, they return the same input string sliced from the front up to where
 * they finished parsing.
 *
 * @typeParam T - the type of {@link CSTNode | CST node} this parser outputs
 * @param input - the input string
 * @returns the parse result
 */
export type Parser<T extends CSTNode> = (
  input: string
) => Matched<T> | NotMatched;

/**
 * Matches any single character, including whitespace.
 * @see {@link Parser}
 */
export const any: Parser<string> = input => {
  if (input.length > 0) {
    return matched(input[0] as string, input.slice(1));
  } else {
    return notMatched(input);
  }
};

/** Options for {@link str} and {@link re}. */
export interface TrimOptions {
  /**
   * Whether or not to trim leading whitespace before matching
   * @defaultValue true
   */
  trim?: boolean;
}

/**
 * Matches a string.
 *
 * @remarks
 * By default, this will trim leading whitespace. Use {@link TrimOptions.trim} to
 * configure this.
 *
 * @example
 * ```
 * const abc = str("abc");
 * abc("abc");      // matches, rest is ""
 * abc("abcdef");   // matches, rest is "def"
 * abc("  abc123"); // matches, rest is "123"
 * abc("def");      // fails
 * ```
 * @param s - the string to match against
 * @param options - {@link TrimOptions | optional parser options}
 * @returns a parser outputting the same string given
 */
export function str(s: string, options?: TrimOptions): Parser<string> {
  const finalOpts = { trim: true, ...options };
  return input => {
    const finalInput = finalOpts.trim ? input.trimStart() : input;
    if (finalInput.startsWith(s)) {
      return matched(s, finalInput.slice(s.length));
    } else {
      return notMatched(input);
    }
  };
}

/**
 * Matches a {@link RegExp} pattern.
 *
 * @remarks
 * This only ever matches if the pattern matches the start of the string. Also,
 * by default, this will trim leading whitespace. Use {@link TrimOptions.trim}
 * to configure this.
 *
 * @example
 * ```
 * const digits = re(/[0-9]+/);
 * digits("123");    // matches, output is "123", rest is ""
 * digits("123abc"); // matches, output is "123", rest is "abc"
 * digits("  123");  // matches, output is "123", rest is ""
 * digits("abc");    // fails
 * digits("abc123"); // fails
 * ```
 * @param pattern - the pattern to match against
 * @param options - {@link TrimOptions | optional parser options}
 * @returns a parser outputting the matched string
 */
export function re(pattern: RegExp, options?: TrimOptions): Parser<string> {
  const finalOpts = { trim: true, ...options };
  return input => {
    const finalInput = finalOpts.trim ? input.trimStart() : input;
    const result = pattern.exec(finalInput);
    if (result?.index === 0) {
      const match = result[0] as string;
      return matched(match, finalInput.slice(match.length));
    } else {
      return notMatched(input);
    }
  };
}

type TwoOrMoreParsers = [
  Parser<CSTNode>,
  Parser<CSTNode>,
  ...Parser<CSTNode>[]
];

/**
 * Makes a choice between multiple parsers.
 *
 * @remarks
 * This picks the first parser that matches. It fails if all parsers fail. If
 * any parser {@link fail | fails explicitly}, it propagates that failure.
 *
 * @example
 * ```
 * const aOrB = or(str("a"), str("b"));
 * aOrB("a");  // matches, output and rest are same as str("a")
 * aOrB("b");  // matches, output and rest are same as str("b")
 * aOrB("ab"); // matches, output is the same as str("a") and rest is "b"
 * aOrB("c");  // fails
 * ```
 * @param parsers - 2 or more parsers to use
 * @returns a parser outputting the first matched {@link CSTNode | node}
 */
export function or<Ps extends TwoOrMoreParsers>(
  ...parsers: Ps
): Parser<CSTNode> {
  return input => {
    const failures: NotMatched[] = [];

    for (const parser of parsers) {
      const result = parser(input);
      if (result.matched || result.label !== null) {
        return result;
      } else {
        failures.push(result);
      }
    }

    return findFurthestFailure(failures);

    function findFurthestFailure(arr: NotMatched[]): NotMatched {
      return arr.reduce((a, b) => (a.rest.length <= b.rest.length ? a : b));
    }
  };
}

/**
 * Applies two or more parsers sequentially.
 *
 * @remarks
 * This works by passing the {@link Matched.rest | rest} of each parser’s
 * match as the input to the subsequent parser. Therefore, it matches if all
 * parsers match, and fails if any parser fails. If any parser
 * {@link fail | fails explicitly}, it propagates that failure.
 *
 * @example
 * ```
 * const aThenB = seq(str("a"), str("b"));
 * aThenB("ab");  // matches, rest is ""
 * aThenB("abc"); // matches, rest is "c"
 * aThenB("ba");  // fails
 * ```
 * @param parsers - 2 or more parsers to use
 * @returns a parser outputting a {@link CSTSeq} node
 */
export function seq<Ps extends TwoOrMoreParsers>(
  ...parsers: Ps
): Parser<CSTSeq> {
  return input => {
    let currentInput = input;
    const children = [];
    for (const parser of parsers) {
      const result = parser(currentInput);
      if (!result.matched) {
        return result;
      }

      currentInput = result.rest;
      children.push(result.output);
    }

    return matched({ type: "seq", children } as CSTSeq, currentInput);
  };
}

/**
 * Applies a parser zero or more times until it fails.
 *
 * @remarks
 * It will *always* match, unless a call to the parser returns an
 * {@link fail | explicit failure}, in which case that failure is propagated.
 *
 * @example
 * ```
 * const scream = many(str("A"));
 * scream("");        // matches
 * scream("A");       // matches
 * scream("AAAAAAA"); // matches
 * scream("B");       // matches! zero or more behaviour
 * ```
 * @param parser - the parser to use
 * @returns a parser outputting a {@link CSTMany} node
 * @see {@link many1} - same as `many`, but one or more times
 */
export function many<T extends CSTNode>(parser: Parser<T>): Parser<CSTMany> {
  return input => {
    let currentInput = input;
    const children: CSTNode[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = parser(currentInput);
      if (!result.matched) {
        if (result.label === null) {
          break;
        } else {
          return result;
        }
      }

      currentInput = result.rest;
      children.push(result.output);
    }

    return matched({ type: "many", children }, currentInput);
  };
}

/**
 * Applies a parser one or more times until it fails.
 *
 * @remarks
 * It only matches if the given parser matches at least once. Any
 * {@link fail | explicit failure} is propagated.
 *
 * @example
 * ```
 * const scream = many(str("A"));
 * scream("A");       // matches
 * scream("AAAAAAA"); // matches
 * scream("");        // fails
 * scream("B");       // fails
 * ```
 * @param parser - the parser to use
 * @returns a parser outputting a {@link CSTMany} node
 * @see {@link many} - same as `many`, but zero or more times
 */
export function many1<T extends CSTNode>(parser: Parser<T>): Parser<CSTMany> {
  const manyParser = many(parser);
  return input => {
    const result = manyParser(input);
    if (
      (result.matched && result.output.children.length > 0) ||
      (!result.matched && result.label !== null)
    ) {
      return result;
    } else {
      return notMatched(input);
    }
  };
}

/**
 * Applies a parser optionally.
 *
 * @remarks
 * Outputs `null` on failure. Propagates {@link fail | explicit failures}.
 *
 * @example
 * ```
 * const allOrNothing = maybe(str("all"));
 * allOrNothing("all"); // matches, output and rest same as str("all")
 * allOrNothing("");    // matches, output is null and rest is ""
 * allOrNothing("hey"); // matches, output is null and rest is "hey"
 * ```
 * @param parser - the parser to use
 * @returns a parser that outputs the same as `parser`, or null
 */
export function maybe<T extends CSTNode>(parser: Parser<T>): Parser<T | null> {
  return input => {
    const result = parser(input);
    if (result.matched || result.label !== null) {
      return result;
    } else {
      return matched(null, input);
    }
  };
}

/**
 * Matches if the given parser does not match and vice-versa, without consuming
 * any input.
 *
 * @remarks
 * Useful for asserting on the input, as it keeps `rest` equal to the given
 * input. Propagates {@link fail | explicit failures}.
 *
 * @example
 * ```
 * const notCool = not(str("cool"));
 * notCool("foobar"); // matches
 * notCool("cool");   // matches, output is null and rest is "cool"
 * ```
 * @param parser - the parser to use
 * @returns a parser that outputs null
 */
export function not(parser: Parser<CSTNode>): Parser<null> {
  return input => {
    const result = parser(input);
    if (result.matched) {
      return notMatched(input);
    } else if (result.label !== null) {
      return result;
    } else {
      return matched(null, input);
    }
  };
}

/**
 * Puts a tag on a parser to highlight it as important.
 *
 * @remarks
 * This is used when converting a {@link CSTNode | CST} to an
 * {@link ISTNode | IST}; tagged CST nodes are kept around in the IST, as
 * they’re marked by you as important, whilst non-tagged nodes are swept away.
 * Propagates {@link fail | explicit failures}.
 *
 * @param tag - the tag name to use
 * @param parser - the parser to tag
 * @returns a parser that tags the result of the given parser
 */
export function tag<T extends CSTNode>(
  tag: string,
  parser: Parser<T>
): Parser<CSTTagged> {
  return input => {
    const result = parser(input);
    if (result.matched) {
      return matched({ type: "tag", tag, child: result.output }, result.rest);
    } else {
      return result;
    }
  };
}

/**
 * Fails explicitly with the given label, for improved error handling.
 *
 * @remarks
 * If this parser is ever called, it simply fails with a label that is then
 * propagated all the way up, much like a “throw e”. This lets you annotate
 * your grammar with specific failure states that lets you write good error
 * messages.
 *
 * @param label - the label to use
 * @returns a parser that always fails
 */
export function fail(label: string): (input: string) => NotMatched {
  return (input: string) => notMatched(input, label);
}

/**
 * Labels a parser’s failure.
 *
 * @remarks
 * If the given parser fails, it tags that failure with your given label,
 * essentially like doing `or(parser, fail(label))`. Note that if the parser
 * {@link fail | fails explicitly}, the label you gave *will not* override the
 * other one.
 *
 * @param parser - the parser to use
 * @param label - the label to use
 * @returns a parser
 */
export function labelFail<T extends CSTNode>(
  parser: Parser<T>,
  label: string
): Parser<T> {
  return input => {
    const result = parser(input);
    if (result.matched || result.label !== null) {
      return result;
    } else {
      return notMatched(result.rest, label);
    }
  };
}
