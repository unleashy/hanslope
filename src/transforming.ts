import { CSTNode } from "./cst";
import { ISTBranch, ISTNode, ISTSequence } from "./ist";

const istBranchPrototype = {};

/**
 * Transforms a {@link CSTNode | CST} into an {@link ISTNode | IST}.
 *
 * @remarks
 * It does this by maintaining {@link CSTTagged | tagged nodes} and throwing
 * out plain nodes. If your CST has no tagged nodes, it’ll simply join up all
 * `string` leaves together to spit out a single string. Once you add tags, the
 * transformer keeps them around and builds a tree as intelligently as
 * possible.
 *
 * @param cst - the CST to transform
 * @returns the transformed CST as an IST
 * @see {@link ISTNode}
 */
export function cstToIst(cst: CSTNode): ISTNode {
  function isNotLeaf(node: ISTNode): node is ISTBranch | ISTSequence {
    return node !== null && typeof node === "object";
  }

  function isSequence(node: ISTNode): node is ISTSequence {
    return Array.isArray(node);
  }

  function isBranch(node: ISTNode): node is ISTBranch {
    return isNotLeaf(node) && !isSequence(node);
  }

  if (typeof cst === "string" || cst === null) {
    return cst;
  } else if (cst.type === "tag") {
    const obj = Object.create(istBranchPrototype) as ISTBranch;
    obj[cst.tag] = cstToIst(cst.child);
    return obj;
  } else {
    const children = cst.children.map(cstToIst);

    const hasBranches = children.some(isBranch);
    const hasSequences = children.some(isSequence);

    if (cst.type === "seq" && hasBranches && !hasSequences) {
      return Object.assign(
        Object.create(istBranchPrototype),
        ...children.filter(isNotLeaf)
      ) as ISTBranch;
    } else if (hasBranches || hasSequences) {
      return children.filter(isNotLeaf).flat();
    } else {
      return children.join("");
    }
  }
}

const patternBind = Symbol("patternBind");

type PatternBinding = {
  [patternBind]: (value: unknown) => string | null;
};

type Pattern =
  | unknown
  | Pattern[]
  | { [key: string]: Pattern }
  | PatternBinding;

type Transformer<T> = (bindings: Record<string, unknown>) => T;
type Rule<T> = <U>(input: U) => T | U;

export function rule<T>(
  pattern: Pattern,
  transformer: Transformer<T>
): Rule<T> {
  const bindings: Record<string, unknown> = {};

  const isBinding = (p: Pattern): p is PatternBinding => {
    return typeof p === "object" && p !== null && patternBind in p;
  };

  const isObject = (it: unknown): it is Record<string, unknown> => {
    return typeof it === "object" && it !== null && !Array.isArray(it);
  };

  const deeplyEqual = (a: Pattern, b: unknown): boolean => {
    if (isBinding(a)) {
      const boundName = a[patternBind](b);
      if (boundName) {
        bindings[boundName] = b;
        return true;
      } else {
        return false;
      }
    } else if (Array.isArray(a)) {
      return (
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((av, i) => deeplyEqual(av, b[i]))
      );
    } else if (isObject(a)) {
      const entries = Object.entries(a);

      return (
        isObject(b) &&
        entries.length === Object.entries(b).length &&
        entries.every(([key, value]) =>
          key in b ? deeplyEqual(value, b[key]) : false
        )
      );
    } else {
      return a === b;
    }
  };

  return input => (deeplyEqual(pattern, input) ? transformer(bindings) : input);
}

function isComplex(value: unknown): boolean {
  return (
    (value !== null && Object.getPrototypeOf(value) === istBranchPrototype) ||
    Array.isArray(value)
  );
}

export function bindLeaf(name: string): PatternBinding {
  return {
    [patternBind]: value => {
      if (isComplex(value)) {
        return null;
      } else {
        return name;
      }
    }
  };
}

export function bindSequence(name: string): PatternBinding {
  return {
    [patternBind]: value => {
      if (Array.isArray(value) && !value.some(isComplex)) {
        return name;
      } else {
        return null;
      }
    }
  };
}

export function bindAny(name: string): PatternBinding {
  return {
    [patternBind]: () => name
  };
}

type ISTTransformer<T = unknown> = (input: ISTNode) => T;

export function istTransformer<T = unknown>(
  ...rules: [Rule<unknown>, ...Rule<unknown>[]]
): ISTTransformer<T> {
  const applyRules = (node: unknown): unknown => {
    for (const rule of rules) {
      const newNode = rule(node);
      if (newNode !== node) {
        return newNode;
      }
    }

    return node;
  };

  const transform = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return applyRules(node.map(it => transform(it)));
    } else if (typeof node === "object" && node !== null) {
      return applyRules(
        Object.fromEntries(
          Object.entries(node).map(([key, value]) => [key, transform(value)])
        )
      );
    } else {
      return applyRules(node);
    }
  };

  return transform as ISTTransformer<T>;
}
