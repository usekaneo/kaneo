// A task's short id is its project key plus the task number, e.g. "DEP-23".
// Project keys come from `generateProjectSlug`, which follows the same Unicode
// rules as `toSlug`, so a key can be "ПА" or "测试项" and not only A-Z. Matching
// on ASCII alone left those projects without the "type the task key to jump to
// it" path.
export const TASK_SHORT_ID_PATTERN = /^(\p{L}[\p{L}\p{N}\p{M}_-]*)-(\d+)$/u;
