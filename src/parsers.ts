/**
 * A leaf in the CST is either a string or null.
 */
export type CSTLeaf = string | null;

/**
 * A sequence in the CST has 2 or more {@link CSTSeq.children | children}, each
 * of which is another {@link CSTNode} that was matched sequentially by
 * {@link seq}.
 */
export interface CSTSeq {
  type: "seq";
  children: [CSTNode, CSTNode, ...CSTNode[]];
}

/**
 * A many in the CST has 0 or more {@link CSTMany.children | children}, each of
 * which was repeatedly matched by {@link many} or {@link many1}.
 */
export interface CSTMany {
  type: "many";
  children: CSTNode[];
}

/**
 * A tag in the CST represents an “important” node that will be kept around by
 * {@link cstToAst} if possible.
 */
export interface CSTTagged {
  type: "tag";
  tag: string;
  child: CSTNode;
}

/**
 * A *concrete syntax tree* (CST) is built by each parser combinator at the time
 * of parsing, representing the minutiae of each parser, that can then be
 * processed into a more convenient and reduced *abstract syntax tree* (AST) by
 * {@link cstToAst}.
 *
 * @remarks
 * A CST is composed of either one of {@link CSTLeaf}, {@link CSTSeq},
 * {@link CSTMany} and {@link CSTTagged}.
 */
export type CSTNode = CSTLeaf | CSTSeq | CSTMany | CSTTagged;

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
   * A failure label, used to distinguish from explicit failures thrown by
   * {@link fail} and implicit failures that may backtrack, in which case this
   * is `null`.
   */
  readonly label: string | null;
}

/** @internal */
export function notMatched(label: string | null = null): NotMatched {
  return { matched: false, label };
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
    return notMatched();
  }
};

/** Options for {@link str} */
export interface StrOptions {
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
 * By default, this will trim leading whitespace. Use {@link StrOptions.trim} to
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
 * @param options - {@link StrOptions | optional parser options}
 * @returns a parser outputting the same string given
 */
export function str(s: string, options?: StrOptions): Parser<string> {
  const finalOpts = { trim: true, ...options };
  return input => {
    const finalInput = finalOpts.trim ? input.trimStart() : input;
    if (finalInput.startsWith(s)) {
      return matched(s, finalInput.slice(s.length));
    } else {
      return notMatched();
    }
  };
}

/**
 * Matches a {@link RegExp} pattern, trimming leading whitespace.
 *
 * @remarks
 * This only ever matches if the pattern matches the start of the string.
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
 * @returns a parser outputting the matched string
 */
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
    for (const parser of parsers) {
      const result = parser(input);
      if (result.matched || result.label !== null) {
        return result;
      }
    }

    return notMatched();
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
      return notMatched();
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
      return notMatched();
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
 * {@link ASTNode | AST}; tagged CST nodes are kept around in the AST, as
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
  return () => notMatched(label);
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
  return or(parser, fail(label)) as Parser<T>;
}

/**
 * A leaf, which can be a string or null.
 */
export type ASTLeaf = string | null;

/**
 * An array of {@link ASTNode}.
 */
export type ASTCollection = ASTNode[];

/**
 * An object with one or more entries where the key is a string tag and the
 * value is an {@link ASTNode}.
 *
 * @remarks
 * The tag in question is obtained via a {@link CSTTagged | tagged CST node}.
 */
export interface ASTBranch {
  [tag: string]: ASTNode;
}

/**
 * An *abstract syntax tree* (AST) is a basic tree-like structure representing
 * your parse.
 *
 * @remarks
 * It is composed of {@link ASTLeaf | leaves}, with no children,
 * {@link ASTCollection | arrays}, with zero or more children, and
 * {@link ASTBranch | objects}, with one or more entries. You can get an AST by
 * transforming a {@link CSTNode | CST} with {@link cstToAst}.
 */
export type ASTNode = ASTLeaf | ASTCollection | ASTBranch;

/**
 * Transforms a {@link CSTNode | CST} into an {@link ASTNode | AST}.
 *
 * @remarks
 * It does this by maintaining {@link CSTTagged | tagged nodes} and throwing
 * out plain nodes. If your CST has no tagged nodes, it’ll simply join up all
 * `string` leaves together to spit out a single string. Once you add tags, the
 * transformer keeps them around and builds a tree as intelligently as
 * possible.
 *
 * @param cst - the CST to transform
 * @returns the transformed CST as an AST
 * @see {@link ASTNode}
 */
export function cstToAst(cst: CSTNode): ASTNode {
  function isNotLeaf(node: ASTNode): node is ASTBranch | ASTCollection {
    return node !== null && typeof node === "object";
  }

  function isCollection(node: ASTNode): node is ASTCollection {
    return Array.isArray(node);
  }

  function isBranch(node: ASTNode): node is ASTBranch {
    return isNotLeaf(node) && !isCollection(node);
  }

  if (typeof cst === "string" || cst === null) {
    return cst;
  } else if (cst.type === "tag") {
    return { [cst.tag]: cstToAst(cst.child) };
  } else {
    const children = cst.children.map(cstToAst);

    const hasBranches = children.some(isBranch);
    const hasCollections = children.some(isCollection);

    if (cst.type === "seq" && hasBranches && !hasCollections) {
      return Object.assign({}, ...children.filter(isNotLeaf)) as ASTBranch;
    } else if (hasBranches || hasCollections) {
      return children.filter(isNotLeaf).flat();
    } else {
      return children.join("");
    }
  }
}
