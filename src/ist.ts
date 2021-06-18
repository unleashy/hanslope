/**
 * A leaf, which can be a string or null.
 */
export type ISTLeaf = string | null;

/**
 * An array of {@link ISTNode}.
 */
export type ISTSequence = ISTNode[];

/**
 * An object with one or more entries where the key is a string tag and the
 * value is an {@link ISTNode}.
 *
 * @remarks
 * The tag in question is obtained via a {@link CSTTagged | tagged CST node}.
 */
export interface ISTBranch {
  [tag: string]: ISTNode;
}

/**
 * An *intermediate syntax tree* (IST) is a dense tree-like structure
 * representing your parse.
 *
 * @remarks
 * It is composed of {@link ISTLeaf | leaves}, with no children,
 * {@link ISTSequence | arrays}, with zero or more children, and
 * {@link ISTBranch | objects}, with one or more entries. You can get an IST by
 * transforming a {@link CSTNode | CST} with {@link cstToIst}.
 */
export type ISTNode = ISTLeaf | ISTSequence | ISTBranch;
