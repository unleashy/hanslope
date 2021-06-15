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
 * {@link cstToIst} if possible.
 */
export interface CSTTagged {
  type: "tag";
  tag: string;
  child: CSTNode;
}

/**
 * A *concrete syntax tree* (CST) is built by each parser combinator at the time
 * of parsing, representing the minutiae of each parser, that can then be
 * processed into the dense *intermediate syntax tree* (IST) by
 * {@link cstToIst}.
 *
 * @remarks
 * A CST is composed of either one of {@link CSTLeaf}, {@link CSTSeq},
 * {@link CSTMany} and {@link CSTTagged}.
 */
export type CSTNode = CSTLeaf | CSTSeq | CSTMany | CSTTagged;
