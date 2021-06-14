export type CSTLeaf = string | null;

export interface CSTSeq {
  type: "seq";
  children: [CSTNode, CSTNode, ...CSTNode[]];
}

export interface CSTMany {
  type: "many";
  children: CSTNode[];
}

export interface CSTTagged {
  type: "tag";
  tag: string;
  child: CSTNode;
}

export type CSTNode = CSTLeaf | CSTSeq | CSTMany | CSTTagged;

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

export type ASTLeaf = string | null;

export type ASTCollection = ASTNode[];

export interface ASTBranch {
  [tag: string]: ASTNode;
}

export type ASTNode = ASTLeaf | ASTCollection | ASTBranch;

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
      // this is perfectly fine, and i'm not sure why ESLint is annoyed at me
      // eslint-disable-next-line
      return children.filter(isNotLeaf).flat();
    } else {
      return children.join("");
    }
  }
}
