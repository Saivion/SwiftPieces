// Browser page translation (Chrome's "Translate this page") and some extensions swap React's text
// nodes for their own <font> wrappers. React still holds the old node, so its next update calls
// removeChild/insertBefore on a node that's no longer there and the page crashes with
// "NotFoundError: The node to be removed is not a child of this node" (facebook/react#11538).
// When the node has already been moved, skip the call instead of throwing: the translated text
// stays put and the rest of the update goes through.
export function guardForeignDomEdits() {
  if (typeof Node !== "function" || !Node.prototype) return;
  const proto = Node.prototype as Node & { __spGuarded?: true };
  if (proto.__spGuarded) return;
  proto.__spGuarded = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T;
    return insertBefore.call(this, node, ref) as T;
  };
}
