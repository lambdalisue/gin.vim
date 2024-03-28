import * as fs from "https://deno.land/std@0.221.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";

const beginMarker = `${"<".repeat(7)} `;
const endMarker = `${">".repeat(7)} `;

export function stripConflicts(content: string[]): string[] {
  let inner = false;
  return content.filter((v) => {
    if (v.startsWith(beginMarker)) {
      inner = true;
      return false;
    } else if (v.startsWith(endMarker)) {
      inner = false;
      return false;
    }
    return !inner;
  });
}

const validAliasHeads = [
  "MERGE_HEAD",
  "REBASE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
] as const;
export type AliasHead = typeof validAliasHeads[number];

export async function getInProgressAliasHead(
  worktree: string,
): Promise<AliasHead | undefined> {
  for (const head of validAliasHeads) {
    if (await fs.exists(path.join(worktree, ".git", head))) {
      return head;
    }
  }
  return undefined;
}
