import { CSTNode } from "./cst";
import { ISTBranch, ISTCollection, ISTNode } from "./ist";

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
  function isNotLeaf(node: ISTNode): node is ISTBranch | ISTCollection {
    return node !== null && typeof node === "object";
  }

  function isCollection(node: ISTNode): node is ISTCollection {
    return Array.isArray(node);
  }

  function isBranch(node: ISTNode): node is ISTBranch {
    return isNotLeaf(node) && !isCollection(node);
  }

  if (typeof cst === "string" || cst === null) {
    return cst;
  } else if (cst.type === "tag") {
    return { [cst.tag]: cstToIst(cst.child) };
  } else {
    const children = cst.children.map(cstToIst);

    const hasBranches = children.some(isBranch);
    const hasCollections = children.some(isCollection);

    if (cst.type === "seq" && hasBranches && !hasCollections) {
      return Object.assign({}, ...children.filter(isNotLeaf)) as ISTBranch;
    } else if (hasBranches || hasCollections) {
      return children.filter(isNotLeaf).flat();
    } else {
      return children.join("");
    }
  }
}
