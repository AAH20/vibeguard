// @ts-nocheck
// Copied verbatim from continuedev/continue (Apache-2.0), a real test
// fixture at core/autocomplete/context/root-path-context/test/files/typescript/classes.ts.
// Kept here because it's the actual file that made @babel/traverse's own
// scope tracking throw `Duplicate declaration "Group"` during a real scan
// of that codebase — a genuine regression case, not a synthetic one.

class Group extends BaseClass {}

class Group implements FirstInterface {}

class Group extends BaseClass implements FirstInterface, SecondInterface {}

class Group extends BaseClass<User> implements FirstInterface<User> {}
