import {
  any,
  bindLeaf,
  bindSequence,
  CSTNode,
  cstToIst,
  istTransformer,
  labelFail,
  many,
  many1,
  maybe,
  not,
  NotMatched,
  or,
  Parser,
  re,
  rule,
  seq,
  str,
  tag
} from "./index";

/**
 * Represents a parse error, containing a line and column number.
 */
export class ParseError extends Error {}

/**
 * Parses a grammar into an AST.
 *
 * @param input - the input grammar
 * @returns an {@link ASTGrammar | AST} of the parsed grammar
 *
 * @throws {@link ParseError}
 * Thrown on errors.
 */
export function parseGrammar(input: string): ASTGrammar {
  const result = parserRules.Grammar(input);
  if (result.matched) {
    return transformGrammar(cstToIst(result.output));
  } else {
    throw buildParseError(input, result);
  }
}

/**
 * Base interface for all AST nodes.
 */
export interface AST {
  /**
   * Accepts a visitor, calling the appropriate visit method.
   * @param visitor - the visitor to accept
   * @returns whatever the visitor’s visit method returns
   */
  accept: <R>(visitor: ASTVisitor<R>) => R;
}

/**
 * The root node of the grammar AST.
 *
 * @remarks
 * Contains one or more {@link ASTRule | rules}.
 */
export class ASTGrammar implements AST {
  constructor(readonly rules: [ASTRule, ...ASTRule[]]) {}

  accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitGrammar(this);
  }
}

/**
 * Represents a single rule.
 *
 * @remarks
 * Contains a name and an @{link ASTExpr | expression}.
 */
export class ASTRule implements AST {
  constructor(readonly name: string, readonly expr: ASTExpr) {}

  accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitRule(this);
  }
}

/**
 * Tag interface for all expressions.
 */
abstract class ASTExpr implements AST {
  abstract accept<R>(visitor: ASTVisitor<R>): R;
}

/**
 * Represents a choice, like `x | y | z`.
 *
 * @remarks
 * Contains two or more {@link ASTExpr | expressions}.
 */
export class ASTChoice extends ASTExpr {
  constructor(readonly parts: [ASTExpr, ASTExpr, ...ASTExpr[]]) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitChoice(this);
  }
}

/**
 * Represents sequential ordering, like `x y`.
 *
 * @remarks
 * Contains two or more {@link ASTExpr | expressions}.
 */
export class ASTSequence extends ASTExpr {
  constructor(readonly parts: [ASTExpr, ASTExpr, ...ASTExpr[]]) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitSequence(this);
  }
}

/**
 * Represents the zero or more matcher, `x*`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression}.
 */
export class ASTZeroOrMore extends ASTExpr {
  constructor(readonly expr: ASTExpr) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitZeroOrMore(this);
  }
}

/**
 * Represents the one or more matcher, `x+`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression}.
 */
export class ASTOneOrMore extends ASTExpr {
  constructor(readonly expr: ASTExpr) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitOneOrMore(this);
  }
}

/**
 * Represents the maybe matcher, `x?`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression}.
 */
export class ASTMaybe extends ASTExpr {
  constructor(readonly expr: ASTExpr) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitMaybe(this);
  }
}

/**
 * Represents negation, `!x`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression}.
 */
export class ASTNegation extends ASTExpr {
  constructor(readonly expr: ASTExpr) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitNegation(this);
  }
}

/**
 * Represents a tagged expression, `x:tag`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression} and one string tag.
 */
export class ASTTagged extends ASTExpr {
  constructor(readonly expr: ASTExpr, readonly tag: string) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitTagged(this);
  }
}

/**
 * Represents the `any` matcher.
 */
export class ASTAny extends ASTExpr {
  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitAny(this);
  }
}

/**
 * Represents a name.
 */
export class ASTName extends ASTExpr {
  constructor(readonly value: string) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitName(this);
  }
}

/**
 * Represents a string.
 *
 * @remarks
 * May be `trim` or not; is false for `lit"..."` strings.
 */
export class ASTString extends ASTExpr {
  constructor(readonly value: string, readonly trim = true) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitString(this);
  }
}

/**
 * Represents the regex matcher.
 *
 * @remarks
 * May be `trim` or not; is false for `lit/.../` regexes.
 */
export class ASTRegex extends ASTExpr {
  constructor(readonly value: RegExp, readonly trim = true) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitRegex(this);
  }
}

/**
 * Represents an explicit failure instruction, `~label`.
 *
 * @remarks
 * Contains a string label.
 */
export class ASTFail extends ASTExpr {
  constructor(readonly label: string) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitFail(this);
  }
}

/**
 * Represents an explicit failure instruction attached to an expression, `x~label`.
 *
 * @remarks
 * Contains one {@link ASTExpr | expression} and a string label.
 */
export class ASTFailAttached extends ASTExpr {
  constructor(readonly label: string, readonly expr: ASTExpr) {
    super();
  }

  override accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitFailAttached(this);
  }
}

/**
 * A visitor for {@link ASTGrammar | AST nodes}.
 */
export interface ASTVisitor<R> {
  visitGrammar: (node: ASTGrammar) => R;
  visitRule: (node: ASTRule) => R;
  visitChoice: (node: ASTChoice) => R;
  visitSequence: (node: ASTSequence) => R;
  visitZeroOrMore: (node: ASTZeroOrMore) => R;
  visitOneOrMore: (node: ASTOneOrMore) => R;
  visitMaybe: (node: ASTMaybe) => R;
  visitNegation: (node: ASTNegation) => R;
  visitTagged: (node: ASTTagged) => R;
  visitAny: (node: ASTAny) => R;
  visitName: (node: ASTName) => R;
  visitString: (node: ASTString) => R;
  visitRegex: (node: ASTRegex) => R;
  visitFail: (node: ASTFail) => R;
  visitFailAttached: (node: ASTFailAttached) => R;
}

/***** Internals *****/

enum FailLabel {
  noArrow = "noArrow",
  noChoice = "noChoice",
  noExpr = "noExpr",
  noFailLabel = "noFailLabel",
  noRules = "noRules",
  noSemicolon = "noSemicolon",
  noTag = "noTag",
  unclosedParens = "unclosedParens",
  unclosedString = "unclosedString",
  unclosedRegex = "unclosedRegex"
}

const ref =
  (name: string): Parser<CSTNode> =>
  input =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (parserRules as Record<string, Parser<CSTNode>>)[name]!(input);

const parserRules = {
  Name: re(/[a-z0-9_]+/i),
  Escape: seq(str("\\", { trim: false }), any),
  StrChar: seq(not(str('"', { trim: false })), any),
  Str: seq(
    or(str('"'), str('lit"')),
    many(or(ref("Escape"), ref("StrChar"))),
    labelFail(str('"', { trim: false }), FailLabel.unclosedString)
  ),
  RegexChar: seq(not(str("/", { trim: false })), any),
  Regex: seq(
    or(str("/"), str("lit/")),
    many1(or(ref("Escape"), ref("RegexChar"))),
    labelFail(str("/", { trim: false }), FailLabel.unclosedRegex),
    re(/[imsu]*/, { trim: false })
  ),
  FailLabel: re(/[a-z0-9_]+/i, { trim: false }),
  Fail: seq(
    str("~"),
    labelFail(tag("fail", ref("FailLabel")), FailLabel.noFailLabel)
  ),
  Atom: or(
    tag("any", str("any")),
    tag("str", ref("Str")),
    tag("regex", ref("Regex")),
    tag("name", ref("Name")),
    seq(str("("), ref("Choice"), labelFail(str(")"), FailLabel.unclosedParens)),
    ref("Fail")
  ),
  FailAttachment: seq(
    tag("expr", ref("Atom")),
    tag(
      "fail",
      maybe(
        seq(
          str("~", { trim: false }),
          labelFail(ref("FailLabel"), FailLabel.noFailLabel)
        )
      )
    )
  ),
  Neg: seq(tag("op", maybe(str("!"))), tag("expr", ref("FailAttachment"))),
  Mod: seq(
    tag("expr", ref("Neg")),
    tag("op", maybe(or(str("*"), str("+"), str("?"))))
  ),
  Tagged: or(
    seq(
      tag("expr", ref("Mod")),
      str(":"),
      labelFail(tag("tag", ref("Name")), FailLabel.noTag)
    ),
    ref("Mod")
  ),
  Seq: tag("seq", many1(ref("Tagged"))),
  Choice: tag(
    "choice",
    seq(
      ref("Seq"),
      many(seq(str("|"), labelFail(ref("Seq"), FailLabel.noChoice)))
    )
  ),
  Rule: seq(
    tag("name", ref("Name")),
    labelFail(str("<-"), FailLabel.noArrow),
    labelFail(tag("expr", ref("Choice")), FailLabel.noExpr),
    labelFail(str(";"), FailLabel.noSemicolon)
  ),
  Grammar: labelFail(tag("grammar", many1(ref("Rule"))), FailLabel.noRules)
};

function buildParseError(input: string, result: NotMatched): ParseError {
  const message = (() => {
    // prettier-ignore
    switch (result.label as FailLabel | null) {
      case FailLabel.noArrow: return "expected '<-' after rule name";
      case FailLabel.noChoice: return "expected expression after '|'";
      case FailLabel.noExpr: return "expected an expression for rule";
      case FailLabel.noFailLabel: return "expected a label after '~'";
      case FailLabel.noRules: return "grammar is empty";
      case FailLabel.noSemicolon: return "expected a semicolon after rule";
      case FailLabel.noTag: return "expected a tag after ':'";
      case FailLabel.unclosedParens: return "expected ')' to close matching '('";
      case FailLabel.unclosedString: return `expected '"' to close string`;
      case FailLabel.unclosedRegex: return "expected '/' to close string";
      default: return "syntax invalid";
    }
  })();

  const location = (() => {
    const restIndex =
      result.rest.length > 0 ? input.lastIndexOf(result.rest) : input.length;
    const before = input.slice(0, restIndex);

    const lines = before.split("\n");
    const lastLine = lines[lines.length - 1] as string;
    return {
      line: lines.length,
      column: lastLine.length + 1
    };
  })();

  return new ParseError(
    `${message} at line ${location.line}, column ${location.column}`
  );
}

// prettier-ignore
const transformGrammar = istTransformer<ASTGrammar>(
  rule(
    { any: "any" },
    () => new ASTAny()
  ),
  rule(
    { str: [] },
    () => new ASTString("")
  ),
  rule(
    { str: bindLeaf("str") },
    ({ str }: { str: string }) => {
      const { result, isTrim } = sanitiseRawString(str);
      return new ASTString(result, isTrim);
    }
  ),
  rule(
    { regex: bindLeaf("regex") },
    ({ regex }: { regex: string }) => {
      const { result, flags, isTrim } = sanitiseRawRegex(regex);
      return new ASTRegex(new RegExp(result, flags), isTrim);
    }
  ),
  rule(
    { name: bindLeaf("name") },
    ({ name }: { name: string }) => new ASTName(name)
  ),
  rule(
    { fail: bindLeaf("label") },
    ({ label }: { label: string }) => new ASTFail(label)
  ),
  rule(
    { expr: bindLeaf("expr"), fail: bindLeaf("label") },
    ({ expr, label }: { expr: ASTExpr; label: string | null }) =>
      label ? new ASTFailAttached(label.slice(1), expr) : expr
  ),
  rule(
    { expr: bindLeaf("expr"), op: bindLeaf("op") },
    ({ expr, op }: { expr: ASTExpr, op: null | "*" | "+" | "?" | "!" }) => {
      switch (op) {
        case null: return expr;
        case "*": return new ASTZeroOrMore(expr);
        case "+": return new ASTOneOrMore(expr);
        case "?": return new ASTMaybe(expr);
        case "!": return new ASTNegation(expr);
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        default: throw new Error(`unknown op '${op}'`);
      }
    }
  ),
  rule(
    { expr: bindLeaf("expr"), tag: bindLeaf("tag") },
    ({ expr, tag }: { expr: ASTExpr, tag: string }) => new ASTTagged(expr, tag)
  ),
  rule(
    { seq: bindSequence("parts") },
    ({ parts }: { parts: ASTExpr[] }) =>
      parts.length === 1 ?
        parts[0] :
        new ASTSequence(parts as [ASTExpr, ASTExpr, ...ASTExpr[]])
  ),
  rule(
    { choice: bindSequence("parts") },
    ({ parts }: { parts: ASTExpr[] }) =>
      parts.length === 1 ?
        parts[0] :
        new ASTChoice(parts as [ASTExpr, ASTExpr, ...ASTExpr[]])
  ),
  rule(
    { name: bindLeaf("name"), expr: bindLeaf("expr") },
    ({ name, expr }: { name: string; expr: ASTExpr }) => new ASTRule(name, expr)
  ),
  rule(
    { grammar: bindSequence("rules") },
    ({ rules }: { rules: [ASTRule, ...ASTRule[]] }) => new ASTGrammar(rules)
  )
);

/**
 * Removes leading/trailing quotes, replaces escapes with their meaning, and
 * determines if the string is `trim` or not.
 */
function sanitiseRawString(str: string): { result: string; isTrim: boolean } {
  const isTrim = str.startsWith('"');

  return {
    result: str.slice(isTrim ? 1 : 4, -1).replace(/\\./g, match => {
      const escapeChar = match[1] as string;
      // prettier-ignore
      switch (escapeChar) {
        case "0":
          return "\0";
        case "'":
          return "'";
        case "\"":
          return "\"";
        case "\\":
          return "\\";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "v":
          return "\v";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        default:
          return escapeChar;
      }
    }),
    isTrim
  };
}

/**
 * Removes leading/trailing slashes and separates flags.
 */
function sanitiseRawRegex(str: string): {
  result: string;
  flags?: string;
  isTrim: boolean;
} {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [result, flags] = /^(?:lit)?\/(.+)\/([imsu]+)?$/.exec(str)!.slice(1);

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    result: result!,
    flags,
    isTrim: str.startsWith("/")
  };
}
